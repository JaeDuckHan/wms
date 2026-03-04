const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");

const router = express.Router();

const baseProductSchema = z.object({
  client_id: z.coerce.number().int().positive().optional(),
  client_code: z.string().max(50).optional(),
  sku_code: z.string().max(100).nullable().optional(),
  barcode_raw: z.string().min(1).max(120),
  barcode_full: z.string().min(1).max(180),
  name_kr: z.string().min(1).max(255),
  name_en: z.string().max(255).nullable().optional(),
  volume_ml: z.coerce.number().int().positive().nullable().optional(),
  width_cm: z.coerce.number().positive().nullable().optional(),
  length_cm: z.coerce.number().positive().nullable().optional(),
  height_cm: z.coerce.number().positive().nullable().optional(),
  min_storage_fee_month: z.coerce.number().nonnegative().nullable().optional(),
  unit: z.string().max(30).nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

const productCreateSchema = baseProductSchema.superRefine((value, ctx) => {
  const hasClientId = Number(value.client_id) > 0;
  const hasClientCode = typeof value.client_code === "string" && value.client_code.trim().length > 0;
  if (!hasClientId && !hasClientCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "client_id or client_code is required",
      path: ["client_id"]
    });
  }
});

const productUpdateSchema = baseProductSchema
  .extend({
    status: z.enum(["active", "inactive"])
  })
  .superRefine((value, ctx) => {
    const hasClientId = Number(value.client_id) > 0;
    const hasClientCode = typeof value.client_code === "string" && value.client_code.trim().length > 0;
    if (!hasClientId && !hasClientCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "client_id or client_code is required",
        path: ["client_id"]
      });
    }
  });

const productSelectColumns = `
  p.id,
  p.client_id,
  c.client_code,
  p.sku_code,
  p.barcode_raw,
  p.barcode_full,
  p.name_kr,
  p.name_en,
  p.volume_ml,
  p.width_cm,
  p.length_cm,
  p.height_cm,
  p.cbm_m3,
  p.min_storage_fee_month,
  p.unit,
  p.status,
  p.created_at,
  p.updated_at
`;

function isMysqlDuplicate(error) {
  return error && error.code === "ER_DUP_ENTRY";
}

function isMysqlForeignKey(error) {
  return error && error.code === "ER_NO_REFERENCED_ROW_2";
}

function toNullableNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function computeCbmM3(widthCm, lengthCm, heightCm) {
  if (!(widthCm > 0) || !(lengthCm > 0) || !(heightCm > 0)) {
    return null;
  }

  const cbm = (widthCm * lengthCm * heightCm) / 1000000;
  return Number(cbm.toFixed(6));
}

async function resolveClientId(inputClientId, inputClientCode) {
  const numericClientId = Number(inputClientId || 0);
  if (Number.isInteger(numericClientId) && numericClientId > 0) {
    return numericClientId;
  }

  const clientCode = String(inputClientCode || "").trim();
  if (!clientCode) {
    return null;
  }

  const [rows] = await getPool().query(
    `SELECT id
     FROM clients
     WHERE client_code = ? AND deleted_at IS NULL
     LIMIT 1`,
    [clientCode]
  );
  if (rows.length === 0) {
    return null;
  }
  return Number(rows[0].id);
}

router.get("/", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT ${productSelectColumns}
       FROM products p
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.deleted_at IS NULL
       ORDER BY p.id DESC`
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT ${productSelectColumns}
       FROM products p
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Product not found" });
    }
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/", validate(productCreateSchema), async (req, res) => {
  const {
    client_id,
    client_code = null,
    sku_code = null,
    barcode_raw,
    barcode_full,
    name_kr,
    name_en = null,
    volume_ml = null,
    width_cm = null,
    length_cm = null,
    height_cm = null,
    min_storage_fee_month = 0,
    unit = null,
    status = "active"
  } = req.body;

  if ((!client_id && !client_code) || !barcode_raw || !barcode_full || !name_kr) {
    return res.status(400).json({
      ok: false,
      message: "client_id(or client_code), barcode_raw, barcode_full, name_kr are required"
    });
  }

  try {
    const clientId = await resolveClientId(client_id, client_code);
    if (!clientId) {
      return res.status(400).json({ ok: false, message: "Invalid client_id/client_code" });
    }

    const widthCm = toNullableNumber(width_cm);
    const lengthCm = toNullableNumber(length_cm);
    const heightCm = toNullableNumber(height_cm);
    const cbmM3 = computeCbmM3(widthCm, lengthCm, heightCm);
    const minStorageFeeMonth = toNullableNumber(min_storage_fee_month);

    const [result] = await getPool().query(
      `INSERT INTO products
        (client_id, sku_code, barcode_raw, barcode_full, name_kr, name_en, volume_ml, width_cm, length_cm, height_cm, cbm_m3, min_storage_fee_month, unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        sku_code,
        barcode_raw,
        barcode_full,
        name_kr,
        name_en,
        volume_ml,
        widthCm,
        lengthCm,
        heightCm,
        cbmM3,
        minStorageFeeMonth == null ? 0 : minStorageFeeMonth,
        unit,
        status
      ]
    );

    const [rows] = await getPool().query(
      `SELECT ${productSelectColumns}
       FROM products p
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate product barcode" });
    }
    if (isMysqlForeignKey(error)) {
      return res.status(400).json({ ok: false, message: "Invalid client_id" });
    }
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/:id", validate(productUpdateSchema), async (req, res) => {
  const {
    client_id,
    client_code,
    sku_code,
    barcode_raw,
    barcode_full,
    name_kr,
    name_en,
    volume_ml,
    width_cm,
    length_cm,
    height_cm,
    min_storage_fee_month,
    unit,
    status
  } = req.body;

  if ((!client_id && !client_code) || !barcode_raw || !barcode_full || !name_kr || !status) {
    return res.status(400).json({
      ok: false,
      message: "client_id(or client_code), barcode_raw, barcode_full, name_kr, status are required"
    });
  }

  try {
    const clientId = await resolveClientId(client_id, client_code);
    if (!clientId) {
      return res.status(400).json({ ok: false, message: "Invalid client_id/client_code" });
    }

    const widthCm = toNullableNumber(width_cm);
    const lengthCm = toNullableNumber(length_cm);
    const heightCm = toNullableNumber(height_cm);
    const cbmM3 = computeCbmM3(widthCm, lengthCm, heightCm);
    const minStorageFeeMonth = toNullableNumber(min_storage_fee_month);

    const [result] = await getPool().query(
      `UPDATE products
       SET client_id = ?, sku_code = ?, barcode_raw = ?, barcode_full = ?, name_kr = ?, name_en = ?,
           volume_ml = ?, width_cm = ?, length_cm = ?, height_cm = ?, cbm_m3 = ?, min_storage_fee_month = ?, unit = ?, status = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        clientId,
        sku_code || null,
        barcode_raw,
        barcode_full,
        name_kr,
        name_en || null,
        volume_ml || null,
        widthCm,
        lengthCm,
        heightCm,
        cbmM3,
        minStorageFeeMonth == null ? 0 : minStorageFeeMonth,
        unit || null,
        status,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Product not found" });
    }

    const [rows] = await getPool().query(
      `SELECT ${productSelectColumns}
       FROM products p
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate product barcode" });
    }
    if (isMysqlForeignKey(error)) {
      return res.status(400).json({ ok: false, message: "Invalid client_id" });
    }
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const [result] = await getPool().query(
      "UPDATE products SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Product not found" });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
