const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");
const { BoxPackingError, validateBoxItemTotals } = require("../services/outboundBoxPacking");

const router = express.Router();

const boxItemSchema = z.object({
  outbound_item_id: z.coerce.number().int().positive(),
  packed_qty: z.coerce.number().int().positive()
});

const createBoxSchema = z.object({
  box_no: z.string().min(1).max(80),
  courier: z.string().max(100).nullable().optional(),
  tracking_no: z.string().max(120).nullable().optional(),
  item_count: z.coerce.number().int().min(0).optional(),
  items: z.array(boxItemSchema).min(1)
});

const updateBoxSchema = z.object({
  box_no: z.string().min(1).max(80),
  courier: z.string().max(100).nullable().optional(),
  tracking_no: z.string().max(120).nullable().optional(),
  status: z.enum(["open", "packed", "shipped"]).optional(),
  items: z.array(boxItemSchema).min(1).optional()
});

const replaceBoxItemsSchema = z.object({
  items: z.array(boxItemSchema).min(1)
});

async function hasOutboundOrder(outboundOrderId) {
  const [rows] = await getPool().query(
    "SELECT id FROM outbound_orders WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [outboundOrderId]
  );
  return rows.length > 0;
}

async function hasOutboundBox(conn, outboundOrderId, boxId) {
  const [rows] = await conn.query(
    `SELECT id
     FROM outbound_boxes
     WHERE id = ? AND outbound_order_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [boxId, outboundOrderId]
  );
  return rows.length > 0;
}

function isMysqlDuplicate(error) {
  return error && error.code === "ER_DUP_ENTRY";
}

function isMysqlMissingTable(error) {
  return error && error.code === "ER_NO_SUCH_TABLE";
}

function isBoxPackingError(error) {
  return (
    error instanceof BoxPackingError ||
    [
      "EMPTY_BOX_ITEMS",
      "INVALID_BOX_ITEM",
      "INVALID_PACKED_QTY",
      "INVALID_PACKED_QTY_TOTAL"
    ].includes(error.code)
  );
}

function sumPackedQty(items) {
  return items.reduce((sum, item) => sum + Number(item.packed_qty), 0);
}

async function getBoxItems(conn, boxIds) {
  if (boxIds.length === 0) return new Map();
  const placeholders = boxIds.map(() => "?").join(", ");
  const [rows] = await conn.query(
    `SELECT
       obi.id,
       obi.outbound_box_id,
       obi.outbound_item_id,
       obi.packed_qty,
       oi.product_id,
       oi.lot_id,
       oi.location_id,
       oi.qty AS requested_qty,
       p.barcode_full,
       p.name_kr AS product_name,
       pl.lot_no,
       wl.location_code
     FROM outbound_box_items obi
     JOIN outbound_items oi ON oi.id = obi.outbound_item_id AND oi.deleted_at IS NULL
     JOIN products p ON p.id = oi.product_id AND p.deleted_at IS NULL
     JOIN product_lots pl ON pl.id = oi.lot_id AND pl.deleted_at IS NULL
     LEFT JOIN warehouse_locations wl ON wl.id = oi.location_id AND wl.deleted_at IS NULL
     WHERE obi.outbound_box_id IN (${placeholders})
       AND obi.deleted_at IS NULL
     ORDER BY obi.id ASC`,
    boxIds
  );
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.outbound_box_id) ?? [];
    list.push(row);
    grouped.set(row.outbound_box_id, list);
  }
  return grouped;
}

function attachItemsToBoxes(boxRows, itemMap) {
  return boxRows.map((box) => ({
    ...box,
    items: itemMap.get(box.id) ?? []
  }));
}

async function validateBoxItemsForOrder(conn, outboundOrderId, boxId, items) {
  const outboundItemIds = items.map((item) => item.outbound_item_id);
  const placeholders = outboundItemIds.map(() => "?").join(", ");
  const [validRows] = await conn.query(
    `SELECT id, qty
     FROM outbound_items
     WHERE outbound_order_id = ?
       AND id IN (${placeholders})
       AND deleted_at IS NULL`,
    [outboundOrderId, ...outboundItemIds]
  );
  const requestedQtyByItemId = new Map(validRows.map((row) => [Number(row.id), Number(row.qty)]));
  const [packedRows] = await conn.query(
    `SELECT obi.outbound_item_id, COALESCE(SUM(obi.packed_qty), 0) AS packed_qty
     FROM outbound_box_items obi
     JOIN outbound_boxes ob ON ob.id = obi.outbound_box_id AND ob.deleted_at IS NULL
     WHERE ob.outbound_order_id = ?
       AND obi.outbound_box_id <> ?
       AND obi.outbound_item_id IN (${placeholders})
       AND obi.deleted_at IS NULL
     GROUP BY obi.outbound_item_id`,
    [outboundOrderId, boxId, ...outboundItemIds]
  );
  const existingPackedQtyByItemId = new Map(
    packedRows.map((row) => [Number(row.outbound_item_id), Number(row.packed_qty)])
  );

  return validateBoxItemTotals({
    nextItems: items,
    requestedQtyByItemId,
    existingPackedQtyByItemId
  });
}

async function insertBoxItems(conn, boxId, items) {
  for (const item of items) {
    await conn.query(
      `INSERT INTO outbound_box_items (outbound_box_id, outbound_item_id, packed_qty)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE packed_qty = VALUES(packed_qty), deleted_at = NULL`,
      [boxId, item.outbound_item_id, item.packed_qty]
    );
  }
}

async function replaceBoxItems(conn, outboundOrderId, boxId, items) {
  const validatedItems = await validateBoxItemsForOrder(conn, outboundOrderId, boxId, items);
  await conn.query(
    "UPDATE outbound_box_items SET deleted_at = NOW() WHERE outbound_box_id = ? AND deleted_at IS NULL",
    [boxId]
  );
  await insertBoxItems(conn, boxId, validatedItems);
  return validatedItems;
}

router.get("/:id/boxes", async (req, res) => {
  try {
    const outboundOrderId = Number(req.params.id);
    const exists = await hasOutboundOrder(outboundOrderId);
    if (!exists) {
      return res.status(404).json({ ok: false, message: "Outbound order not found" });
    }

    const [rows] = await getPool().query(
      `SELECT id, outbound_order_id, box_no, courier, tracking_no, item_count, status, created_at, updated_at
       FROM outbound_boxes
       WHERE outbound_order_id = ? AND deleted_at IS NULL
       ORDER BY id DESC`,
      [outboundOrderId]
    );
    const itemMap = await getBoxItems(getPool(), rows.map((row) => row.id));
    return res.json({ ok: true, data: attachItemsToBoxes(rows, itemMap) });
  } catch (error) {
    if (isMysqlMissingTable(error)) {
      return res.status(500).json({ ok: false, message: "Outbound box item table is not ready" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/:id/boxes", validate(createBoxSchema), async (req, res) => {
  const conn = await getPool().getConnection();
  try {
    const outboundOrderId = Number(req.params.id);
    await conn.beginTransaction();
    const [orderRows] = await conn.query(
      "SELECT id FROM outbound_orders WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [outboundOrderId]
    );
    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Outbound order not found" });
    }

    const { box_no, courier = null, tracking_no = null, items } = req.body;
    const validatedItems = await validateBoxItemsForOrder(conn, outboundOrderId, 0, items);
    const itemCount = sumPackedQty(validatedItems);

    const [result] = await conn.query(
      `INSERT INTO outbound_boxes (outbound_order_id, box_no, courier, tracking_no, item_count, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [outboundOrderId, box_no, courier, tracking_no, itemCount]
    );

    await insertBoxItems(conn, result.insertId, validatedItems);

    const [rows] = await conn.query(
      `SELECT id, outbound_order_id, box_no, courier, tracking_no, item_count, status, created_at, updated_at
       FROM outbound_boxes
       WHERE id = ?`,
      [result.insertId]
    );
    const itemMap = await getBoxItems(conn, [result.insertId]);
    await conn.commit();

    return res.status(201).json({ ok: true, data: attachItemsToBoxes(rows, itemMap)[0] });
  } catch (error) {
    await conn.rollback();
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate box_no in outbound order" });
    }
    if (isBoxPackingError(error)) {
      return res.status(400).json({ ok: false, code: error.code, message: error.message });
    }
    return res.status(500).json({ ok: false, message: error.message });
  } finally {
    conn.release();
  }
});

router.get("/:id/boxes/:boxId/items", async (req, res) => {
  const conn = getPool();
  try {
    const outboundOrderId = Number(req.params.id);
    const boxId = Number(req.params.boxId);
    const exists = await hasOutboundBox(conn, outboundOrderId, boxId);
    if (!exists) {
      return res.status(404).json({ ok: false, message: "Outbound box not found" });
    }
    const itemMap = await getBoxItems(conn, [boxId]);
    return res.json({ ok: true, data: itemMap.get(boxId) ?? [] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/:id/boxes/:boxId/items", validate(replaceBoxItemsSchema), async (req, res) => {
  const conn = await getPool().getConnection();
  try {
    const outboundOrderId = Number(req.params.id);
    const boxId = Number(req.params.boxId);
    await conn.beginTransaction();
    const exists = await hasOutboundBox(conn, outboundOrderId, boxId);
    if (!exists) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Outbound box not found" });
    }
    const validatedItems = await replaceBoxItems(conn, outboundOrderId, boxId, req.body.items);
    const itemMap = await getBoxItems(conn, [boxId]);
    const itemCount = sumPackedQty(validatedItems);
    await conn.query("UPDATE outbound_boxes SET item_count = ? WHERE id = ?", [itemCount, boxId]);
    await conn.commit();
    return res.json({ ok: true, data: itemMap.get(boxId) ?? [] });
  } catch (error) {
    await conn.rollback();
    if (isBoxPackingError(error)) {
      return res.status(400).json({ ok: false, code: error.code, message: error.message });
    }
    return res.status(500).json({ ok: false, message: error.message });
  } finally {
    conn.release();
  }
});

router.put("/:id/boxes/:boxId", validate(updateBoxSchema), async (req, res) => {
  const conn = await getPool().getConnection();
  try {
    const outboundOrderId = Number(req.params.id);
    const boxId = Number(req.params.boxId);
    await conn.beginTransaction();
    const [orderRows] = await conn.query(
      "SELECT id FROM outbound_orders WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [outboundOrderId]
    );
    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Outbound order not found" });
    }

    const [boxRows] = await conn.query(
      `SELECT id
       FROM outbound_boxes
       WHERE id = ? AND outbound_order_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [boxId, outboundOrderId]
    );
    if (boxRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Outbound box not found" });
    }

    const { box_no, courier = null, tracking_no = null, status, items } = req.body;
    let itemCount = 0;
    if (items) {
      const validatedItems = await replaceBoxItems(conn, outboundOrderId, boxId, items);
      itemCount = sumPackedQty(validatedItems);
    } else {
      const itemMap = await getBoxItems(conn, [boxId]);
      itemCount = sumPackedQty(itemMap.get(boxId) ?? []);
    }

    const [result] = await conn.query(
      `UPDATE outbound_boxes
       SET box_no = ?, courier = ?, tracking_no = ?, item_count = ?, status = COALESCE(?, status)
       WHERE id = ? AND outbound_order_id = ? AND deleted_at IS NULL`,
      [box_no, courier, tracking_no, itemCount, status ?? null, boxId, outboundOrderId]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Outbound box not found" });
    }

    const [rows] = await conn.query(
      `SELECT id, outbound_order_id, box_no, courier, tracking_no, item_count, status, created_at, updated_at
       FROM outbound_boxes
       WHERE id = ?`,
      [boxId]
    );
    const updatedItemMap = await getBoxItems(conn, [boxId]);
    await conn.commit();

    return res.json({ ok: true, data: attachItemsToBoxes(rows, updatedItemMap)[0] });
  } catch (error) {
    await conn.rollback();
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate box_no in outbound order" });
    }
    if (isBoxPackingError(error)) {
      return res.status(400).json({ ok: false, code: error.code, message: error.message });
    }
    return res.status(500).json({ ok: false, message: error.message });
  } finally {
    conn.release();
  }
});

router.delete("/:id/boxes/:boxId", async (req, res) => {
  const conn = await getPool().getConnection();
  try {
    const outboundOrderId = Number(req.params.id);
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE outbound_boxes
       SET deleted_at = NOW()
       WHERE id = ? AND outbound_order_id = ? AND deleted_at IS NULL`,
      [req.params.boxId, outboundOrderId]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Outbound box not found" });
    }
    await conn.query(
      "UPDATE outbound_box_items SET deleted_at = NOW() WHERE outbound_box_id = ? AND deleted_at IS NULL",
      [req.params.boxId]
    );
    await conn.commit();
    return res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ ok: false, message: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
