const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");
const {
  StockError,
  withTransaction,
  getOutboundOrderContext
} = require("../services/stock");

const router = express.Router();

const outboundItemSchema = z.object({
  outbound_order_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  lot_id: z.coerce.number().int().positive(),
  location_id: z.coerce.number().int().positive().nullable().optional(),
  qty: z.coerce.number().int().positive(),
  box_type: z.string().max(80).nullable().optional(),
  box_count: z.coerce.number().int().min(0).default(0),
  remark: z.string().max(500).nullable().optional()
});

function isMysqlForeignKey(error) {
  return error && error.code === "ER_NO_REFERENCED_ROW_2";
}

async function ensureOutboundOrderLogsTable(conn) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS outbound_order_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      outbound_order_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(40) NOT NULL,
      from_status VARCHAR(30) NULL,
      to_status VARCHAR(30) NULL,
      note VARCHAR(1000) NULL,
      actor_user_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_outbound_order_logs_order_created (outbound_order_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

function resolveActorUserId(req, fallbackUserId) {
  const tokenUserId = Number(req.user?.sub || 0);
  if (Number.isFinite(tokenUserId) && tokenUserId > 0) return tokenUserId;
  const fallback = Number(fallbackUserId || 0);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}

async function appendOutboundOrderLog(conn, { outboundOrderId, action, note, actorUserId }) {
  await ensureOutboundOrderLogsTable(conn);
  await conn.query(
    `INSERT INTO outbound_order_logs (outbound_order_id, action, note, actor_user_id)
     VALUES (?, ?, ?, ?)`,
    [outboundOrderId, action, note || null, actorUserId]
  );
}

async function validateLotBelongsToProduct(conn, productId, lotId) {
  const [rows] = await conn.query(
    "SELECT id FROM product_lots WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
    [lotId, productId]
  );
  return rows.length > 0;
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

router.get("/", async (req, res) => {
  const outboundOrderId = req.query.outbound_order_id;

  try {
    let query = `SELECT id, outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at
                 FROM outbound_items
                 WHERE deleted_at IS NULL`;
    const params = [];

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
    const [rows] = await getPool().query(
      `SELECT id, outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at
       FROM outbound_items
       WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
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
      const validLot = await validateLotBelongsToProduct(conn, product_id, lot_id);
      if (!validLot) {
        throw new StockError("INVALID_LOT_PRODUCT", "lot_id does not belong to product_id");
      }

      const order = await getOutboundOrderContext(conn, outbound_order_id);
      if (!order) {
        throw new StockError("INVALID_ORDER", "Invalid outbound_order_id");
      }
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
        [outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark]
      );
      await appendOutboundOrderLog(conn, {
        outboundOrderId: order.id,
        action: "item_create",
        note: `Item added (product=${product_id}, lot=${lot_id}, qty=${qty}, box_count=${box_count})`,
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

      const validLot = await validateLotBelongsToProduct(conn, product_id, lot_id);
      if (!validLot) {
        throw new StockError("INVALID_LOT_PRODUCT", "lot_id does not belong to product_id");
      }

      const nextOrder = await getOutboundOrderContext(conn, outbound_order_id);
      if (!nextOrder) {
        throw new StockError("INVALID_ORDER", "Invalid outbound_order_id");
      }
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

      await conn.query(
        `UPDATE outbound_items
         SET outbound_order_id = ?, product_id = ?, lot_id = ?, location_id = ?, qty = ?, box_type = ?, box_count = ?, remark = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          outbound_order_id,
          product_id,
          lot_id,
          location_id || null,
          qty,
          box_type || null,
          box_count,
          remark || null,
          req.params.id
        ]
      );
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
