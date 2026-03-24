const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");
const {
  StockError,
  withTransaction,
  adjustAvailableQty,
  adjustReservedQty,
  upsertStockTxn,
  getStockTxnId,
  softDeleteStockTxn
} = require("../services/stock");
const {
  upsertOutboundServiceEvent,
  softDeleteOutboundServiceEvent
} = require("../services/billing");
const { syncOutboundOrderBillingEvent } = require("../services/billingEvents");
const { getScopedClientId } = require("../middleware/clientScope");

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

function isReservationAppliedStatus(status) {
  return status === "allocated" || status === "picking" || status === "packed";
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

async function getOutboundOrderOrThrow(conn, outboundOrderId, scopedClientId = null) {
  const [rows] = await conn.query(
    `SELECT id, outbound_no, client_id, warehouse_id, order_date, status, created_by
     FROM outbound_orders
     WHERE id = ? AND deleted_at IS NULL
     ${scopedClientId ? "AND client_id = ?" : ""}
     LIMIT 1`,
    scopedClientId ? [outboundOrderId, scopedClientId] : [outboundOrderId]
  );
  if (rows.length === 0) {
    throw toAppError("NOT_FOUND", "Outbound order not found");
  }
  return rows[0];
}

function toDateValue(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function rankSuggestionCandidate(candidate, item) {
  const sameLotAndLocation =
    Number(candidate.lot_id) === Number(item.lot_id) &&
    Number(candidate.location_id || 0) === Number(item.location_id || 0);
  const sameLot = Number(candidate.lot_id) === Number(item.lot_id);
  const sameLocation = Number(candidate.location_id || 0) === Number(item.location_id || 0);
  return [
    sameLotAndLocation ? 0 : sameLot ? 1 : sameLocation ? 2 : 3,
    toDateValue(candidate.expiry_date),
    toDateValue(candidate.mfg_date),
    String(candidate.location_code || ""),
  ];
}

function compareSuggestionCandidates(a, b, item) {
  const left = rankSuggestionCandidate(a, item);
  const right = rankSuggestionCandidate(b, item);
  for (let idx = 0; idx < left.length; idx += 1) {
    if (left[idx] < right[idx]) return -1;
    if (left[idx] > right[idx]) return 1;
  }
  if (Number(b.allocatable_qty) !== Number(a.allocatable_qty)) {
    return Number(b.allocatable_qty) - Number(a.allocatable_qty);
  }
  return String(a.location_code || "").localeCompare(String(b.location_code || ""));
}

async function buildAllocationSuggestions(conn, order, items) {
  const suggestions = [];

  for (const item of items) {
    const [candidateRows] = await conn.query(
      `SELECT
          sb.product_id,
          sb.lot_id,
          sb.location_id,
          GREATEST(COALESCE(sb.available_qty, 0) - COALESCE(sb.reserved_qty, 0), 0) AS allocatable_qty,
          pl.lot_no,
          pl.expiry_date,
          pl.mfg_date,
          wl.location_code
       FROM stock_balances sb
       JOIN product_lots pl ON pl.id = sb.lot_id AND pl.deleted_at IS NULL
       LEFT JOIN warehouse_locations wl ON wl.id = sb.location_id AND wl.deleted_at IS NULL
       WHERE sb.client_id = ?
         AND sb.warehouse_id = ?
         AND sb.product_id = ?
         AND sb.deleted_at IS NULL
         AND GREATEST(COALESCE(sb.available_qty, 0) - COALESCE(sb.reserved_qty, 0), 0) > 0`,
      [order.client_id, order.warehouse_id, item.product_id]
    );

    const sortedCandidates = candidateRows.sort((a, b) => compareSuggestionCandidates(a, b, item));
    let remaining = Number(item.qty);
    const allocationPlan = sortedCandidates
      .map((candidate) => {
        const suggestedQty = Math.min(remaining, Number(candidate.allocatable_qty));
        remaining -= suggestedQty;
        return {
          product_id: Number(candidate.product_id),
          lot_id: Number(candidate.lot_id),
          lot_no: candidate.lot_no,
          location_id: candidate.location_id == null ? null : Number(candidate.location_id),
          location_code: candidate.location_code || "-",
          allocatable_qty: Number(candidate.allocatable_qty),
          suggested_qty: suggestedQty,
          expiry_date: candidate.expiry_date,
          mfg_date: candidate.mfg_date,
        };
      })
      .filter((candidate) => candidate.suggested_qty > 0);

    const networkAllocatableQty = allocationPlan.reduce((sum, candidate) => sum + Number(candidate.allocatable_qty), 0);
    suggestions.push({
      outbound_item_id: Number(item.id),
      product_id: Number(item.product_id),
      requested_qty: Number(item.qty),
      network_allocatable_qty: networkAllocatableQty,
      shortage_qty: Math.max(Number(item.qty) - networkAllocatableQty, 0),
      suggested_strategy:
        allocationPlan.length === 0
          ? "shortage"
          : allocationPlan.length === 1 &&
              Number(allocationPlan[0].lot_id) === Number(item.lot_id) &&
              Number(allocationPlan[0].location_id || 0) === Number(item.location_id || 0)
            ? "current"
            : "reallocate",
      allocation_plan: allocationPlan,
    });
  }

  return suggestions;
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

async function applyReservationEffects(conn, order, items) {
  for (const item of items) {
    await adjustReservedQty(
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
  }
}

async function rollbackReservationEffects(conn, order, items) {
  for (const item of items) {
    await adjustReservedQty(
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
  }
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
  await getPool().query(
    `INSERT INTO outbound_order_logs (outbound_order_id, action, from_status, to_status, note, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [outboundOrderId, action, fromStatus, toStatus, note, actorUserId]
  );
}

router.get("/", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const [rows] = await getPool().query(
      `SELECT id, outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status, packed_at, shipped_at, created_by, created_at, updated_at
       FROM outbound_orders
       WHERE deleted_at IS NULL
       ${scopedClientId ? "AND client_id = ?" : ""}
       ORDER BY id DESC`,
      scopedClientId ? [scopedClientId] : []
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const [rows] = await getPool().query(
      `SELECT id, outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status, packed_at, shipped_at, created_by, created_at, updated_at
       FROM outbound_orders
       WHERE id = ? AND deleted_at IS NULL
       ${scopedClientId ? "AND client_id = ?" : ""}`,
      scopedClientId ? [req.params.id, scopedClientId] : [req.params.id]
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
    const scopedClientId = getScopedClientId(req);
    const [rows] = await getPool().query(
      `SELECT l.id, l.outbound_order_id, l.action, l.from_status, l.to_status, l.note, l.actor_user_id,
              u.email AS actor_email, u.name AS actor_name, l.created_at
       FROM outbound_order_logs l
       JOIN outbound_orders oo ON oo.id = l.outbound_order_id AND oo.deleted_at IS NULL
       LEFT JOIN users u ON u.id = l.actor_user_id
       WHERE l.outbound_order_id = ?
       ${scopedClientId ? "AND oo.client_id = ?" : ""}
       ORDER BY l.id ASC`,
      scopedClientId ? [req.params.id, scopedClientId] : [req.params.id]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/:id/allocation-suggestions", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const result = await withTransaction(async (conn) => {
      const order = await getOutboundOrderOrThrow(conn, req.params.id, scopedClientId);
      const items = await getOutboundItems(conn, order.id);
      return buildAllocationSuggestions(conn, order, items);
    });
    return res.json({ ok: true, data: result });
  } catch (error) {
    if (error && error.code === "NOT_FOUND") {
      return res.status(404).json({ ok: false, message: "Outbound order not found" });
    }
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
      const wasReserved = isReservationAppliedStatus(previous.status);
      const willReserve = isReservationAppliedStatus(status);

      if (wasApplied && (Number(previous.client_id) !== Number(client_id) || Number(previous.warehouse_id) !== Number(warehouse_id))) {
        throw toAppError("ORDER_LOCKED_FIELDS", "Cannot change client/warehouse after shipment");
      }
      if (wasReserved && (Number(previous.client_id) !== Number(client_id) || Number(previous.warehouse_id) !== Number(warehouse_id))) {
        throw toAppError("ORDER_LOCKED_FIELDS", "Cannot change client/warehouse after allocation");
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

      if (wasApplied && !willApply) {
        await rollbackShipmentEffects(conn, previous, items);
        if (willReserve) {
          await applyReservationEffects(conn, updated, items);
        }
      } else if (!wasApplied && willApply) {
        if (wasReserved) {
          await rollbackReservationEffects(conn, previous, items);
        }
        await applyShipmentEffects(conn, updated, items);
      } else if (!wasReserved && willReserve) {
        await applyReservationEffects(conn, updated, items);
      } else if (wasReserved && !willReserve) {
        await rollbackReservationEffects(conn, previous, items);
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
      } else if (isReservationAppliedStatus(current.status)) {
        const items = await getOutboundItems(conn, current.id);
        await rollbackReservationEffects(conn, current, items);
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
