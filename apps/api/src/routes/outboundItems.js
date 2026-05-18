const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");
const {
  StockError,
  withTransaction,
  getOutboundOrderContext,
  adjustReservedQty
} = require("../services/stock");
const { getScopedClientId } = require("../middleware/clientScope");

const router = express.Router();

const outboundItemSchema = z.object({
  outbound_order_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  lot_id: z.coerce.number().int().positive().nullable().optional(),
  location_id: z.coerce.number().int().positive().nullable().optional(),
  qty: z.coerce.number().int().positive(),
  box_type: z.string().max(80).nullable().optional(),
  box_count: z.coerce.number().int().min(0).default(0),
  remark: z.string().max(500).nullable().optional()
});

function isMysqlForeignKey(error) {
  return error && error.code === "ER_NO_REFERENCED_ROW_2";
}

function isMysqlMissingTable(error) {
  return error && error.code === "ER_NO_SUCH_TABLE";
}

function resolveActorUserId(req, fallbackUserId) {
  const tokenUserId = Number(req.user?.sub || 0);
  if (Number.isFinite(tokenUserId) && tokenUserId > 0) return tokenUserId;
  const fallback = Number(fallbackUserId || 0);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}

async function appendOutboundOrderLog(conn, { outboundOrderId, action, note, actorUserId }) {
  try {
    await conn.query(
      `INSERT INTO outbound_order_logs (outbound_order_id, action, note, actor_user_id)
       VALUES (?, ?, ?, ?)`,
      [outboundOrderId, action, note || null, actorUserId]
    );
  } catch (error) {
    if (!isMysqlMissingTable(error)) {
      throw error;
    }
  }
}

async function validateLotBelongsToProduct(conn, productId, lotId) {
  const [rows] = await conn.query(
    "SELECT id FROM product_lots WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
    [lotId, productId]
  );
  return rows.length > 0;
}

async function resolveLotId(conn, productId, lotId) {
  if (lotId) {
    const validLot = await validateLotBelongsToProduct(conn, productId, lotId);
    if (!validLot) {
      throw new StockError("INVALID_LOT_PRODUCT", "lot_id does not belong to product_id");
    }
    return lotId;
  }

  const [result] = await conn.query(
    `INSERT INTO product_lots (product_id, lot_no, status, deleted_at)
     VALUES (?, 'NO-LOT', 'active', NULL)
     ON DUPLICATE KEY UPDATE deleted_at = NULL, status = 'active', id = LAST_INSERT_ID(id)`,
    [productId]
  );
  return result.insertId;
}

async function getOutboundItemWithContext(conn, itemId) {
  const [rows] = await conn.query(
    `SELECT oi.id, oi.outbound_order_id, oi.product_id, oi.lot_id, oi.location_id, oi.qty, oi.box_type, oi.box_count, oi.remark, oi.created_at, oi.updated_at,
            oo.client_id, oo.warehouse_id, oo.created_by, oo.status
     FROM outbound_items oi
     JOIN outbound_orders oo ON oo.id = oi.outbound_order_id
     WHERE oi.id = ? AND oi.deleted_at IS NULL`,
    [itemId]
  );
  return rows[0] || null;
}

function isShippedLockedStatus(status) {
  return status === "shipped" || status === "delivered";
}

function isReservationAppliedStatus(status) {
  return status === "allocated" || status === "picking" || status === "packed";
}

async function adjustItemReservation(conn, order, item, delta) {
  await adjustReservedQty(
    conn,
    {
      clientId: order.client_id,
      productId: item.product_id,
      lotId: item.lot_id,
      warehouseId: order.warehouse_id,
      locationId: item.location_id ?? null
    },
    Number(delta)
  );
}

async function getPackedQtyForOutboundItem(conn, outboundItemId) {
  try {
    const [rows] = await conn.query(
      `SELECT COALESCE(SUM(obi.packed_qty), 0) AS packed_qty
       FROM outbound_box_items obi
       JOIN outbound_boxes ob ON ob.id = obi.outbound_box_id AND ob.deleted_at IS NULL
       WHERE obi.outbound_item_id = ?
         AND obi.deleted_at IS NULL`,
      [outboundItemId]
    );
    return Number(rows[0]?.packed_qty || 0);
  } catch (error) {
    if (isMysqlMissingTable(error)) return 0;
    throw error;
  }
}

async function assertPackedQtyWithinItemQty(conn, outboundItemId, qty) {
  const packedQty = await getPackedQtyForOutboundItem(conn, outboundItemId);
  if (packedQty > Number(qty)) {
    throw new StockError(
      "PACKED_QTY_EXCEEDS_QTY",
      `Packed qty (${packedQty}) cannot exceed outbound item qty (${qty})`
    );
  }
}

async function refreshOutboundBoxItemCount(conn, outboundBoxId) {
  await conn.query(
    `UPDATE outbound_boxes
     SET item_count = (
       SELECT COALESCE(SUM(packed_qty), 0)
       FROM outbound_box_items
       WHERE outbound_box_id = ? AND deleted_at IS NULL
     )
     WHERE id = ?`,
    [outboundBoxId, outboundBoxId]
  );
}

async function softDeletePackedItemsForOutboundItem(conn, outboundItemId) {
  try {
    const [boxRows] = await conn.query(
      `SELECT DISTINCT outbound_box_id
       FROM outbound_box_items
       WHERE outbound_item_id = ?
         AND deleted_at IS NULL`,
      [outboundItemId]
    );
    if (boxRows.length === 0) return;

    await conn.query(
      `UPDATE outbound_box_items
       SET deleted_at = NOW()
       WHERE outbound_item_id = ?
         AND deleted_at IS NULL`,
      [outboundItemId]
    );

    for (const row of boxRows) {
      await refreshOutboundBoxItemCount(conn, row.outbound_box_id);
    }
  } catch (error) {
    if (!isMysqlMissingTable(error)) {
      throw error;
    }
  }
}

router.get("/", async (req, res) => {
  const outboundOrderId = req.query.outbound_order_id;

  try {
    const scopedClientId = getScopedClientId(req);
    let query = `SELECT id, outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at
                 FROM outbound_items
                 WHERE deleted_at IS NULL`;
    const params = [];

    if (scopedClientId) {
      query += " AND outbound_order_id IN (SELECT id FROM outbound_orders WHERE client_id = ? AND deleted_at IS NULL)";
      params.push(scopedClientId);
    }

    if (outboundOrderId) {
      query += " AND outbound_order_id = ?";
      params.push(outboundOrderId);
    }

    query += " ORDER BY id DESC";

    const [rows] = await getPool().query(query, params);
    res.json({ ok: true, data: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const [rows] = await getPool().query(
      `SELECT id, outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at
       FROM outbound_items
       WHERE id = ? AND deleted_at IS NULL
       ${scopedClientId ? "AND outbound_order_id IN (SELECT id FROM outbound_orders WHERE client_id = ? AND deleted_at IS NULL)" : ""}`,
      scopedClientId ? [req.params.id, scopedClientId] : [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Outbound item not found" });
    }
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/", validate(outboundItemSchema), async (req, res) => {
  const {
    outbound_order_id,
    product_id,
    lot_id,
    location_id = null,
    qty,
    box_type = null,
    box_count = 0,
    remark = null
  } = req.body;

  try {
    const created = await withTransaction(async (conn) => {
      const order = await getOutboundOrderContext(conn, outbound_order_id);
      if (!order) {
        throw new StockError("INVALID_ORDER", "Invalid outbound_order_id");
      }
      const resolvedLotId = await resolveLotId(conn, product_id, lot_id);
      const [orderRows] = await conn.query(
        `SELECT status FROM outbound_orders WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [outbound_order_id]
      );
      if (orderRows.length === 0) {
        throw new StockError("INVALID_ORDER", "Invalid outbound_order_id");
      }
      if (isShippedLockedStatus(orderRows[0].status)) {
        throw new StockError("ORDER_LOCKED", "Cannot modify items after shipment");
      }

      const [result] = await conn.query(
        `INSERT INTO outbound_items (outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [outbound_order_id, product_id, resolvedLotId, location_id, qty, box_type, box_count, remark]
      );
      if (isReservationAppliedStatus(orderRows[0].status)) {
        await adjustItemReservation(
          conn,
          order,
          { product_id, lot_id: resolvedLotId, location_id, qty },
          qty
        );
      }
      await appendOutboundOrderLog(conn, {
        outboundOrderId: order.id,
        action: "item_create",
        note: `Item added (product=${product_id}, lot=${resolvedLotId}, qty=${qty}, box_count=${box_count})`,
        actorUserId: resolveActorUserId(req, order.created_by)
      });

      const [rows] = await conn.query(
        `SELECT id, outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at
         FROM outbound_items
         WHERE id = ?`,
        [result.insertId]
      );
      return rows[0];
    });

    return res.status(201).json({ ok: true, data: created });
  } catch (error) {
    if (isMysqlForeignKey(error)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid outbound_order_id, product_id, lot_id or location_id"
      });
    }
    if (error instanceof StockError) {
      const status = error.code === "ORDER_LOCKED" ? 409 : 400;
      return res.status(status).json({ ok: false, code: error.code, message: error.message });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/:id", validate(outboundItemSchema), async (req, res) => {
  const {
    outbound_order_id,
    product_id,
    lot_id,
    location_id,
    qty,
    box_type,
    box_count,
    remark
  } = req.body;

  try {
    const updated = await withTransaction(async (conn) => {
      const prev = await getOutboundItemWithContext(conn, req.params.id);
      if (!prev) {
        throw new StockError("NOT_FOUND", "Outbound item not found");
      }

      const nextOrder = await getOutboundOrderContext(conn, outbound_order_id);
      if (!nextOrder) {
        throw new StockError("INVALID_ORDER", "Invalid outbound_order_id");
      }
      const resolvedLotId = await resolveLotId(conn, product_id, lot_id);
      if (isShippedLockedStatus(prev.status)) {
        throw new StockError("ORDER_LOCKED", "Cannot modify items after shipment");
      }
      const [nextOrderRows] = await conn.query(
        `SELECT status FROM outbound_orders WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [outbound_order_id]
      );
      if (nextOrderRows.length === 0) {
        throw new StockError("INVALID_ORDER", "Invalid outbound_order_id");
      }
      if (isShippedLockedStatus(nextOrderRows[0].status)) {
        throw new StockError("ORDER_LOCKED", "Cannot modify items after shipment");
      }
      if (Number(prev.outbound_order_id) !== Number(outbound_order_id)) {
        const packedQty = await getPackedQtyForOutboundItem(conn, req.params.id);
        if (packedQty > 0) {
          throw new StockError("PACKED_ITEM_LOCKED", "Cannot move an item that has packed box records");
        }
      }
      await assertPackedQtyWithinItemQty(conn, req.params.id, qty);

      if (isReservationAppliedStatus(prev.status)) {
        await adjustItemReservation(conn, prev, prev, -Number(prev.qty));
      }

      await conn.query(
        `UPDATE outbound_items
         SET outbound_order_id = ?, product_id = ?, lot_id = ?, location_id = ?, qty = ?, box_type = ?, box_count = ?, remark = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          outbound_order_id,
          product_id,
          resolvedLotId,
          location_id || null,
          qty,
          box_type || null,
          box_count,
          remark || null,
          req.params.id
        ]
      );
      if (isReservationAppliedStatus(nextOrderRows[0].status)) {
        await adjustItemReservation(
          conn,
          nextOrder,
          { product_id, lot_id: resolvedLotId, location_id, qty },
          qty
        );
      }
      if (Number(prev.outbound_order_id) !== Number(nextOrder.id)) {
        await appendOutboundOrderLog(conn, {
          outboundOrderId: prev.outbound_order_id,
          action: "item_move_out",
          note: `Item moved out to outbound_order_id=${nextOrder.id} (item=${req.params.id}, qty=${qty})`,
          actorUserId: resolveActorUserId(req, prev.created_by)
        });
      }
      await appendOutboundOrderLog(conn, {
        outboundOrderId: nextOrder.id,
        action: Number(prev.outbound_order_id) === Number(nextOrder.id) ? "item_update" : "item_move_in",
        note:
          Number(prev.outbound_order_id) === Number(nextOrder.id)
            ? `Item updated (item=${req.params.id}, qty ${prev.qty} -> ${qty}, box_count ${prev.box_count} -> ${box_count})`
            : `Item moved in from outbound_order_id=${prev.outbound_order_id} (item=${req.params.id}, qty=${qty})`,
        actorUserId: resolveActorUserId(req, nextOrder.created_by)
      });

      const [rows] = await conn.query(
        `SELECT id, outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at
         FROM outbound_items
         WHERE id = ?`,
        [req.params.id]
      );
      return rows[0];
    });

    return res.json({ ok: true, data: updated });
  } catch (error) {
    if (isMysqlForeignKey(error)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid outbound_order_id, product_id, lot_id or location_id"
      });
    }
    if (error instanceof StockError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "ORDER_LOCKED" ? 409 : 400;
      return res.status(status).json({ ok: false, code: error.code, message: error.message });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await withTransaction(async (conn) => {
      const prev = await getOutboundItemWithContext(conn, req.params.id);
      if (!prev) {
        throw new StockError("NOT_FOUND", "Outbound item not found");
      }
      if (isShippedLockedStatus(prev.status)) {
        throw new StockError("ORDER_LOCKED", "Cannot modify items after shipment");
      }
      if (isReservationAppliedStatus(prev.status)) {
        await adjustItemReservation(conn, prev, prev, -Number(prev.qty));
      }
      await softDeletePackedItemsForOutboundItem(conn, req.params.id);

      await conn.query(
        "UPDATE outbound_items SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [req.params.id]
      );
      await appendOutboundOrderLog(conn, {
        outboundOrderId: prev.outbound_order_id,
        action: "item_delete",
        note: `Item deleted (item=${req.params.id}, product=${prev.product_id}, lot=${prev.lot_id}, qty=${prev.qty})`,
        actorUserId: resolveActorUserId(req, prev.created_by)
      });
    });

    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof StockError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "ORDER_LOCKED" ? 409 : 400;
      return res.status(status).json({ ok: false, code: error.code, message: error.message });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
