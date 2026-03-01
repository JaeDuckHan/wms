const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");
const {
  StockError,
  withTransaction,
  adjustAvailableQty,
  upsertStockTxn,
  getStockTxnId,
  softDeleteStockTxn
} = require("../services/stock");
const {
  upsertOutboundServiceEvent,
  softDeleteOutboundServiceEvent
} = require("../services/billing");
const { syncOutboundOrderBillingEvent } = require("../services/billingEvents");

const router = express.Router();

const outboundOrderSchema = z.object({
  outbound_no: z.string().min(1).max(80),
  client_id: z.coerce.number().int().positive(),
  warehouse_id: z.coerce.number().int().positive(),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sales_channel: z.string().max(80).nullable().optional(),
  order_no: z.string().max(120).nullable().optional(),
  tracking_no: z.string().max(120).nullable().optional(),
  status: z
    .enum([
      "draft",
      "confirmed",
      "allocated",
      "picking",
      "packed",
      "shipped",
      "delivered",
      "cancelled"
    ])
    .default("draft"),
  packed_at: z.string().datetime().nullable().optional(),
  shipped_at: z.string().datetime().nullable().optional(),
  created_by: z.coerce.number().int().positive()
});

function isMysqlDuplicate(error) {
  return error && error.code === "ER_DUP_ENTRY";
}

function isMysqlForeignKey(error) {
  return error && error.code === "ER_NO_REFERENCED_ROW_2";
}

function toMysqlDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

async function ensureOutboundOrderLogsTable() {
  await getPool().query(
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

function deriveOutboundAction(fromStatus, toStatus) {
  if (!fromStatus) return "create";
  if (toStatus === "allocated" && fromStatus !== "allocated") return "allocate";
  if (toStatus === "packed" && fromStatus !== "packed") return "pack";
  if (toStatus === "shipped" && fromStatus !== "shipped") return "ship";
  if (toStatus === "cancelled" && fromStatus !== "cancelled") return "cancel";
  if (fromStatus !== toStatus) return "status_change";
  return "update";
}

function toAppError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isShipmentAppliedStatus(status) {
  return status === "shipped" || status === "delivered";
}

async function getOutboundItems(conn, outboundOrderId) {
  const [rows] = await conn.query(
    `SELECT id, product_id, lot_id, location_id, qty, box_count, remark
     FROM outbound_items
     WHERE outbound_order_id = ? AND deleted_at IS NULL
     ORDER BY id ASC`,
    [outboundOrderId]
  );
  return rows;
}

async function applyShipmentEffects(conn, order, items) {
  for (const item of items) {
    await adjustAvailableQty(
      conn,
      {
        clientId: order.client_id,
        productId: item.product_id,
        lotId: item.lot_id,
        warehouseId: order.warehouse_id,
        locationId: item.location_id
      },
      -Number(item.qty)
    );

    const stockTxnId = await upsertStockTxn(conn, {
      clientId: order.client_id,
      productId: item.product_id,
      lotId: item.lot_id,
      warehouseId: order.warehouse_id,
      locationId: item.location_id,
      txnType: "outbound_ship",
      qtyIn: 0,
      qtyOut: Number(item.qty),
      refType: "outbound_item",
      refId: item.id,
      createdBy: order.created_by,
      note: item.remark
    });

    await upsertOutboundServiceEvent(conn, {
      clientId: order.client_id,
      outboundOrderId: order.id,
      stockTransactionId: stockTxnId,
      orderDate: order.order_date,
      qty: Number(item.qty),
      boxCount: Number(item.box_count || 0),
      remark: item.remark
    });
  }
  await syncOutboundOrderBillingEvent(conn, order.id);
}

async function rollbackShipmentEffects(conn, order, items) {
  for (const item of items) {
    const stockTxnId = await getStockTxnId(conn, "outbound_ship", "outbound_item", item.id);
    if (!stockTxnId) continue;

    await adjustAvailableQty(
      conn,
      {
        clientId: order.client_id,
        productId: item.product_id,
        lotId: item.lot_id,
        warehouseId: order.warehouse_id,
        locationId: item.location_id
      },
      Number(item.qty)
    );
    await softDeleteOutboundServiceEvent(conn, stockTxnId);
    await softDeleteStockTxn(conn, "outbound_ship", "outbound_item", item.id);
  }
  await syncOutboundOrderBillingEvent(conn, order.id);
}

async function appendOutboundOrderLog({
  outboundOrderId,
  action,
  fromStatus = null,
  toStatus = null,
  note = null,
  actorUserId = null
}) {
  await ensureOutboundOrderLogsTable();
  await getPool().query(
    `INSERT INTO outbound_order_logs (outbound_order_id, action, from_status, to_status, note, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [outboundOrderId, action, fromStatus, toStatus, note, actorUserId]
  );
}

router.get("/", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status, packed_at, shipped_at, created_by, created_at, updated_at
       FROM outbound_orders
       WHERE deleted_at IS NULL
       ORDER BY id DESC`
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status, packed_at, shipped_at, created_by, created_at, updated_at
       FROM outbound_orders
       WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Outbound order not found" });
    }
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/:id/logs", async (req, res) => {
  try {
    await ensureOutboundOrderLogsTable();
    const [rows] = await getPool().query(
      `SELECT l.id, l.outbound_order_id, l.action, l.from_status, l.to_status, l.note, l.actor_user_id,
              u.email AS actor_email, u.name AS actor_name, l.created_at
       FROM outbound_order_logs l
       LEFT JOIN users u ON u.id = l.actor_user_id
       WHERE l.outbound_order_id = ?
       ORDER BY l.id ASC`,
      [req.params.id]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/", validate(outboundOrderSchema), async (req, res) => {
  const {
    outbound_no,
    client_id,
    warehouse_id,
    order_date,
    sales_channel = null,
    order_no = null,
    tracking_no = null,
    status = "draft",
    packed_at = null,
    shipped_at = null,
    created_by
  } = req.body;

  try {
    const [result] = await getPool().query(
      `INSERT INTO outbound_orders (outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status, packed_at, shipped_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        outbound_no,
        client_id,
        warehouse_id,
        order_date,
        sales_channel,
        order_no,
        tracking_no,
        status,
        toMysqlDateTime(packed_at),
        toMysqlDateTime(shipped_at),
        created_by
      ]
    );

    const [rows] = await getPool().query(
      `SELECT id, outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status, packed_at, shipped_at, created_by, created_at, updated_at
       FROM outbound_orders
       WHERE id = ?`,
      [result.insertId]
    );
    await appendOutboundOrderLog({
      outboundOrderId: result.insertId,
      action: "create",
      toStatus: status,
      note: `Created outbound order ${outbound_no}`,
      actorUserId: resolveActorUserId(req, created_by)
    });
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate outbound_no" });
    }
    if (isMysqlForeignKey(error)) {
      return res.status(400).json({ ok: false, message: "Invalid client_id, warehouse_id or created_by" });
    }
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/:id", validate(outboundOrderSchema), async (req, res) => {
  const {
    outbound_no,
    client_id,
    warehouse_id,
    order_date,
    sales_channel,
    order_no,
    tracking_no,
    status,
    packed_at,
    shipped_at,
    created_by
  } = req.body;

  try {
    const result = await withTransaction(async (conn) => {
      const [existingRows] = await conn.query(
        `SELECT id, outbound_no, client_id, warehouse_id, order_date, status, created_by
         FROM outbound_orders
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [req.params.id]
      );
      if (existingRows.length === 0) {
        throw toAppError("NOT_FOUND", "Outbound order not found");
      }

      const previous = existingRows[0];
      const wasApplied = isShipmentAppliedStatus(previous.status);
      const willApply = isShipmentAppliedStatus(status);

      if (wasApplied && (Number(previous.client_id) !== Number(client_id) || Number(previous.warehouse_id) !== Number(warehouse_id))) {
        throw toAppError("ORDER_LOCKED_FIELDS", "Cannot change client/warehouse after shipment");
      }

      await conn.query(
        `UPDATE outbound_orders
         SET outbound_no = ?, client_id = ?, warehouse_id = ?, order_date = ?, sales_channel = ?, order_no = ?, tracking_no = ?, status = ?, packed_at = ?, shipped_at = ?, created_by = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          outbound_no,
          client_id,
          warehouse_id,
          order_date,
          sales_channel || null,
          order_no || null,
          tracking_no || null,
          status,
          toMysqlDateTime(packed_at),
          toMysqlDateTime(shipped_at),
          created_by,
          req.params.id
        ]
      );

      const [updatedRows] = await conn.query(
        `SELECT id, outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status, packed_at, shipped_at, created_by, created_at, updated_at
         FROM outbound_orders
         WHERE id = ?`,
        [req.params.id]
      );
      const updated = updatedRows[0];
      const items = await getOutboundItems(conn, updated.id);

      if (!wasApplied && willApply) {
        await applyShipmentEffects(conn, updated, items);
      } else if (wasApplied && !willApply) {
        await rollbackShipmentEffects(conn, previous, items);
      }

      return { updated, previousStatus: previous.status };
    });

    await appendOutboundOrderLog({
      outboundOrderId: Number(req.params.id),
      action: deriveOutboundAction(result.previousStatus, status),
      fromStatus: result.previousStatus,
      toStatus: status,
      note:
        result.previousStatus !== status
          ? `${result.previousStatus} -> ${status}`
          : "Outbound order updated",
      actorUserId: resolveActorUserId(req, created_by)
    });
    res.json({ ok: true, data: result.updated });
  } catch (error) {
    if (error && error.code === "NOT_FOUND") {
      return res.status(404).json({ ok: false, message: "Outbound order not found" });
    }
    if (error && error.code === "ORDER_LOCKED_FIELDS") {
      return res.status(409).json({ ok: false, code: error.code, message: error.message });
    }
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate outbound_no" });
    }
    if (isMysqlForeignKey(error)) {
      return res.status(400).json({ ok: false, message: "Invalid client_id, warehouse_id or created_by" });
    }
    if (error instanceof StockError) {
      return res.status(400).json({ ok: false, code: error.code, message: error.message });
    }
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const existing = await withTransaction(async (conn) => {
      const [existingRows] = await conn.query(
        `SELECT id, status, client_id, warehouse_id
         FROM outbound_orders
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [req.params.id]
      );
      if (existingRows.length === 0) {
        throw toAppError("NOT_FOUND", "Outbound order not found");
      }
      const current = existingRows[0];
      if (isShipmentAppliedStatus(current.status)) {
        const items = await getOutboundItems(conn, current.id);
        await rollbackShipmentEffects(conn, current, items);
      }
      await conn.query(
        "UPDATE outbound_orders SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [req.params.id]
      );
      return current;
    });

    await appendOutboundOrderLog({
      outboundOrderId: Number(req.params.id),
      action: "delete",
      fromStatus: existing.status,
      toStatus: null,
      note: "Outbound order deleted",
      actorUserId: resolveActorUserId(req, null)
    });
    res.json({ ok: true });
  } catch (error) {
    if (error && error.code === "NOT_FOUND") {
      return res.status(404).json({ ok: false, message: "Outbound order not found" });
    }
    if (error instanceof StockError) {
      return res.status(400).json({ ok: false, code: error.code, message: error.message });
    }
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
