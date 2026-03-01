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
const { syncInboundOrderBillingEvent } = require("../services/billingEvents");

const router = express.Router();

const inboundOrderCreateSchema = z.object({
  inbound_no: z.string().min(1).max(80),
  client_id: z.coerce.number().int().positive(),
  warehouse_id: z.coerce.number().int().positive(),
  inbound_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["draft", "submitted", "arrived", "qc_hold", "received", "cancelled"]).default("draft"),
  memo: z.string().max(1000).nullable().optional(),
  created_by: z.coerce.number().int().positive(),
  received_at: z.string().datetime().nullable().optional()
});

const inboundOrderUpdateSchema = inboundOrderCreateSchema.extend({
  status: z.enum(["draft", "submitted", "arrived", "qc_hold", "received", "cancelled"])
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

async function ensureInboundOrderLogsTable() {
  await getPool().query(
    `CREATE TABLE IF NOT EXISTS inbound_order_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      inbound_order_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(40) NOT NULL,
      from_status VARCHAR(30) NULL,
      to_status VARCHAR(30) NULL,
      note VARCHAR(1000) NULL,
      actor_user_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inbound_order_logs_order_created (inbound_order_id, created_at)
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

function deriveInboundAction(fromStatus, toStatus) {
  if (!fromStatus) return "create";
  if (toStatus === "submitted" && fromStatus !== "submitted") return "submit";
  if (toStatus === "arrived" && fromStatus !== "arrived") return "arrive";
  if (toStatus === "received" && fromStatus !== "received") return "receive";
  if (toStatus === "cancelled" && fromStatus !== "cancelled") return "cancel";
  if (fromStatus !== toStatus) return "status_change";
  return "update";
}

function toAppError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isReceiptAppliedStatus(status) {
  return status === "received";
}

async function getInboundItems(conn, inboundOrderId) {
  const [rows] = await conn.query(
    `SELECT id, product_id, lot_id, location_id, qty, remark
     FROM inbound_items
     WHERE inbound_order_id = ? AND deleted_at IS NULL
     ORDER BY id ASC`,
    [inboundOrderId]
  );
  return rows;
}

async function applyReceiptEffects(conn, order, items) {
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
      Number(item.qty)
    );

    await upsertStockTxn(conn, {
      clientId: order.client_id,
      productId: item.product_id,
      lotId: item.lot_id,
      warehouseId: order.warehouse_id,
      locationId: item.location_id,
      txnType: "inbound_receive",
      qtyIn: Number(item.qty),
      qtyOut: 0,
      refType: "inbound_item",
      refId: item.id,
      createdBy: order.created_by,
      note: item.remark
    });
  }

  await syncInboundOrderBillingEvent(conn, order.id);
}

async function rollbackReceiptEffects(conn, order, items) {
  for (const item of items) {
    const stockTxnId = await getStockTxnId(conn, "inbound_receive", "inbound_item", item.id);
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
      -Number(item.qty)
    );

    await softDeleteStockTxn(conn, "inbound_receive", "inbound_item", item.id);
  }

  await syncInboundOrderBillingEvent(conn, order.id);
}

async function appendInboundOrderLog({
  inboundOrderId,
  action,
  fromStatus = null,
  toStatus = null,
  note = null,
  actorUserId = null
}) {
  await ensureInboundOrderLogsTable();
  await getPool().query(
    `INSERT INTO inbound_order_logs (inbound_order_id, action, from_status, to_status, note, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [inboundOrderId, action, fromStatus, toStatus, note, actorUserId]
  );
}

router.get("/", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at, created_at, updated_at
       FROM inbound_orders
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
      `SELECT id, inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at, created_at, updated_at
       FROM inbound_orders
       WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Inbound order not found" });
    }
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/:id/logs", async (req, res) => {
  try {
    await ensureInboundOrderLogsTable();
    const [rows] = await getPool().query(
      `SELECT l.id, l.inbound_order_id, l.action, l.from_status, l.to_status, l.note, l.actor_user_id,
              u.email AS actor_email, u.name AS actor_name, l.created_at
       FROM inbound_order_logs l
       LEFT JOIN users u ON u.id = l.actor_user_id
       WHERE l.inbound_order_id = ?
       ORDER BY l.id ASC`,
      [req.params.id]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/", validate(inboundOrderCreateSchema), async (req, res) => {
  const {
    inbound_no,
    client_id,
    warehouse_id,
    inbound_date,
    status = "draft",
    memo = null,
    created_by,
    received_at = null
  } = req.body;

  if (!inbound_no || !client_id || !warehouse_id || !inbound_date || !created_by) {
    return res.status(400).json({
      ok: false,
      message: "inbound_no, client_id, warehouse_id, inbound_date, created_by are required"
    });
  }

  try {
    const [result] = await getPool().query(
      `INSERT INTO inbound_orders (inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, toMysqlDateTime(received_at)]
    );

    const [rows] = await getPool().query(
      `SELECT id, inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at, created_at, updated_at
       FROM inbound_orders
       WHERE id = ?`,
      [result.insertId]
    );
    await appendInboundOrderLog({
      inboundOrderId: result.insertId,
      action: "create",
      toStatus: status,
      note: `Created inbound order ${inbound_no}`,
      actorUserId: resolveActorUserId(req, created_by)
    });
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate inbound_no" });
    }
    if (isMysqlForeignKey(error)) {
      return res.status(400).json({ ok: false, message: "Invalid client_id, warehouse_id or created_by" });
    }
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/:id", validate(inboundOrderUpdateSchema), async (req, res) => {
  const {
    inbound_no,
    client_id,
    warehouse_id,
    inbound_date,
    status,
    memo,
    created_by,
    received_at
  } = req.body;

  if (!inbound_no || !client_id || !warehouse_id || !inbound_date || !status || !created_by) {
    return res.status(400).json({
      ok: false,
      message: "inbound_no, client_id, warehouse_id, inbound_date, status, created_by are required"
    });
  }

  try {
    const result = await withTransaction(async (conn) => {
      const [existingRows] = await conn.query(
        `SELECT id, status, client_id, warehouse_id, created_by
         FROM inbound_orders
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [req.params.id]
      );
      if (existingRows.length === 0) {
        throw toAppError("NOT_FOUND", "Inbound order not found");
      }

      const previous = existingRows[0];
      const wasApplied = isReceiptAppliedStatus(previous.status);
      const willApply = isReceiptAppliedStatus(status);

      if (wasApplied && (Number(previous.client_id) !== Number(client_id) || Number(previous.warehouse_id) !== Number(warehouse_id))) {
        throw toAppError("ORDER_LOCKED_FIELDS", "Cannot change client/warehouse after receipt");
      }

      await conn.query(
        `UPDATE inbound_orders
         SET inbound_no = ?, client_id = ?, warehouse_id = ?, inbound_date = ?, status = ?, memo = ?, created_by = ?, received_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          inbound_no,
          client_id,
          warehouse_id,
          inbound_date,
          status,
          memo || null,
          created_by,
          toMysqlDateTime(received_at),
          req.params.id
        ]
      );

      const [rows] = await conn.query(
        `SELECT id, inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at, created_at, updated_at
         FROM inbound_orders
         WHERE id = ?`,
        [req.params.id]
      );
      const updated = rows[0];
      const items = await getInboundItems(conn, updated.id);

      if (!wasApplied && willApply) {
        await applyReceiptEffects(conn, updated, items);
      } else if (wasApplied && !willApply) {
        await rollbackReceiptEffects(conn, previous, items);
      } else if (willApply) {
        await syncInboundOrderBillingEvent(conn, updated.id);
      }

      return { updated, previousStatus: previous.status };
    });

    await appendInboundOrderLog({
      inboundOrderId: Number(req.params.id),
      action: deriveInboundAction(result.previousStatus, status),
      fromStatus: result.previousStatus,
      toStatus: status,
      note: result.previousStatus !== status ? `${result.previousStatus} -> ${status}` : "Inbound order updated",
      actorUserId: resolveActorUserId(req, created_by)
    });
    res.json({ ok: true, data: result.updated });
  } catch (error) {
    if (error && error.code === "NOT_FOUND") {
      return res.status(404).json({ ok: false, message: "Inbound order not found" });
    }
    if (error && error.code === "ORDER_LOCKED_FIELDS") {
      return res.status(409).json({ ok: false, code: error.code, message: error.message });
    }
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate inbound_no" });
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
         FROM inbound_orders
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [req.params.id]
      );
      if (existingRows.length === 0) {
        throw toAppError("NOT_FOUND", "Inbound order not found");
      }
      const current = existingRows[0];

      if (isReceiptAppliedStatus(current.status)) {
        const items = await getInboundItems(conn, current.id);
        await rollbackReceiptEffects(conn, current, items);
      }

      await conn.query(
        "UPDATE inbound_orders SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [req.params.id]
      );

      return current;
    });

    await appendInboundOrderLog({
      inboundOrderId: Number(req.params.id),
      action: "delete",
      fromStatus: existing.status,
      toStatus: null,
      note: "Inbound order deleted",
      actorUserId: resolveActorUserId(req, null)
    });
    res.json({ ok: true });
  } catch (error) {
    if (error && error.code === "NOT_FOUND") {
      return res.status(404).json({ ok: false, message: "Inbound order not found" });
    }
    if (error instanceof StockError) {
      return res.status(400).json({ ok: false, code: error.code, message: error.message });
    }
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
