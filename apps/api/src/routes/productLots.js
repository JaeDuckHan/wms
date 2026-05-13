const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");
const { getScopedClientId } = require("../middleware/clientScope");

const router = express.Router();

const productLotCreateSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  lot_no: z.string().trim().min(1).max(120),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  mfg_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["active", "hold", "expired", "inactive"]).default("active")
});

function isMysqlForeignKey(error) {
  return error && error.code === "ER_NO_REFERENCED_ROW_2";
}

async function productIsAllowed(productId, scopedClientId) {
  const [rows] = await getPool().query(
    `SELECT id
     FROM products
     WHERE id = ? AND deleted_at IS NULL
     ${scopedClientId ? "AND client_id = ?" : ""}
     LIMIT 1`,
    scopedClientId ? [productId, scopedClientId] : [productId]
  );
  return rows.length > 0;
}

router.get("/", async (req, res) => {
  const { product_id, client_id, status } = req.query;

  try {
    const scopedClientId = getScopedClientId(req);
    let query = `SELECT pl.id, pl.product_id, pl.lot_no, pl.expiry_date, pl.mfg_date, pl.status, pl.created_at, pl.updated_at
                 FROM product_lots pl
                 JOIN products p ON p.id = pl.product_id
                 WHERE pl.deleted_at IS NULL
                   AND p.deleted_at IS NULL`;
    const params = [];

    if (product_id) {
      query += " AND pl.product_id = ?";
      params.push(product_id);
    }
    if (scopedClientId) {
      query += " AND p.client_id = ?";
      params.push(scopedClientId);
    } else if (client_id) {
      query += " AND p.client_id = ?";
      params.push(client_id);
    }
    if (status) {
      query += " AND pl.status = ?";
      params.push(status);
    }

    query += " ORDER BY pl.id DESC";

    const [rows] = await getPool().query(query, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const [rows] = await getPool().query(
      `SELECT pl.id, pl.product_id, pl.lot_no, pl.expiry_date, pl.mfg_date, pl.status, pl.created_at, pl.updated_at
       FROM product_lots pl
       JOIN products p ON p.id = pl.product_id
       WHERE pl.id = ? AND pl.deleted_at IS NULL AND p.deleted_at IS NULL
       ${scopedClientId ? "AND p.client_id = ?" : ""}`,
      scopedClientId ? [req.params.id, scopedClientId] : [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Product lot not found" });
    }
    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/", validate(productLotCreateSchema), async (req, res) => {
  const {
    product_id,
    lot_no,
    expiry_date = null,
    mfg_date = null,
    status = "active"
  } = req.body;

  try {
    const scopedClientId = getScopedClientId(req);
    if (!(await productIsAllowed(product_id, scopedClientId))) {
      return res.status(400).json({ ok: false, message: "Invalid product_id" });
    }

    await getPool().query(
      `INSERT INTO product_lots (product_id, lot_no, expiry_date, mfg_date, status)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         expiry_date = COALESCE(VALUES(expiry_date), expiry_date),
         mfg_date = COALESCE(VALUES(mfg_date), mfg_date),
         status = CASE WHEN deleted_at IS NULL THEN status ELSE VALUES(status) END,
         deleted_at = NULL,
         updated_at = NOW()`,
      [product_id, lot_no, expiry_date, mfg_date, status]
    );

    const [rows] = await getPool().query(
      `SELECT id, product_id, lot_no, expiry_date, mfg_date, status, created_at, updated_at
       FROM product_lots
       WHERE product_id = ? AND lot_no = ? AND deleted_at IS NULL
       LIMIT 1`,
      [product_id, lot_no]
    );

    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (isMysqlForeignKey(error)) {
      return res.status(400).json({ ok: false, message: "Invalid product_id" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
