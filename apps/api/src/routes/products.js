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
  cbm_m3: z.coerce.number().positive().nullable().optional(),
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

const OPTIONAL_PRODUCT_COLUMNS = [
  "width_cm",
  "length_cm",
  "height_cm",
  "cbm_m3",
  "min_storage_fee_month"
];
const OPTIONAL_COLUMNS_CACHE_TTL_MS = 60 * 1000;
let optionalProductColumnsCache = null;
let optionalProductColumnsCachedAt = 0;

async function getAvailableOptionalProductColumns() {
  const now = Date.now();
  if (optionalProductColumnsCache && now - optionalProductColumnsCachedAt < OPTIONAL_COLUMNS_CACHE_TTL_MS) {
    return optionalProductColumnsCache;
  }

  const placeholders = OPTIONAL_PRODUCT_COLUMNS.map(() => "?").join(", ");
  const [rows] = await getPool().query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'products'
       AND column_name IN (${placeholders})`,
    OPTIONAL_PRODUCT_COLUMNS
  );

  optionalProductColumnsCache = new Set(rows.map((row) => String(row.column_name)));
  optionalProductColumnsCachedAt = now;
  return optionalProductColumnsCache;
}

function buildProductSelectColumns(availableColumns) {
  const optionalSelects = OPTIONAL_PRODUCT_COLUMNS.map((column) =>
    availableColumns.has(column) ? `p.${column}` : `NULL AS ${column}`
  );

  return `
    p.id,
    p.client_id,
    c.client_code,
    p.sku_code,
    p.barcode_raw,
    p.barcode_full,
    p.name_kr,
    p.name_en,
    p.volume_ml,
    ${optionalSelects.join(",\n    ")},
    p.unit,
    p.status,
    p.created_at,
    p.updated_at
  `;
}

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
    const availableColumns = await getAvailableOptionalProductColumns();
    const productSelectColumns = buildProductSelectColumns(availableColumns);
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
    const availableColumns = await getAvailableOptionalProductColumns();
    const productSelectColumns = buildProductSelectColumns(availableColumns);
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
    cbm_m3 = null,
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
    const availableColumns = await getAvailableOptionalProductColumns();

    const widthCm = toNullableNumber(width_cm);
    const lengthCm = toNullableNumber(length_cm);
    const heightCm = toNullableNumber(height_cm);
    const requestedCbmM3 = toNullableNumber(cbm_m3);
    const cbmM3 =
      requestedCbmM3 != null && requestedCbmM3 > 0
        ? Number(requestedCbmM3.toFixed(6))
        : computeCbmM3(widthCm, lengthCm, heightCm);
    const minStorageFeeMonth = toNullableNumber(min_storage_fee_month);

    const insertColumns = [
      "client_id",
      "sku_code",
      "barcode_raw",
      "barcode_full",
      "name_kr",
      "name_en",
      "volume_ml"
    ];
    const insertValues = [
      clientId,
      sku_code,
      barcode_raw,
      barcode_full,
      name_kr,
      name_en,
      volume_ml
    ];

    if (availableColumns.has("width_cm")) {
      insertColumns.push("width_cm");
      insertValues.push(widthCm);
    }
    if (availableColumns.has("length_cm")) {
      insertColumns.push("length_cm");
      insertValues.push(lengthCm);
    }
    if (availableColumns.has("height_cm")) {
      insertColumns.push("height_cm");
      insertValues.push(heightCm);
    }
    if (availableColumns.has("cbm_m3")) {
      insertColumns.push("cbm_m3");
      insertValues.push(cbmM3);
    }
    if (availableColumns.has("min_storage_fee_month")) {
      insertColumns.push("min_storage_fee_month");
      insertValues.push(minStorageFeeMonth == null ? 0 : minStorageFeeMonth);
    }

    insertColumns.push("unit", "status");
    insertValues.push(unit, status);

    const [result] = await getPool().query(
      `INSERT INTO products
        (${insertColumns.join(", ")})
       VALUES (${insertColumns.map(() => "?").join(", ")})`,
      insertValues
    );

    const productSelectColumns = buildProductSelectColumns(availableColumns);
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
    cbm_m3,
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
    const availableColumns = await getAvailableOptionalProductColumns();

    const widthCm = toNullableNumber(width_cm);
    const lengthCm = toNullableNumber(length_cm);
    const heightCm = toNullableNumber(height_cm);
    const requestedCbmM3 = toNullableNumber(cbm_m3);
    const cbmM3 =
      requestedCbmM3 != null && requestedCbmM3 > 0
        ? Number(requestedCbmM3.toFixed(6))
        : computeCbmM3(widthCm, lengthCm, heightCm);
    const minStorageFeeMonth = toNullableNumber(min_storage_fee_month);

    const updateAssignments = [
      "client_id = ?",
      "sku_code = ?",
      "barcode_raw = ?",
      "barcode_full = ?",
      "name_kr = ?",
      "name_en = ?",
      "volume_ml = ?"
    ];
    const updateValues = [
      clientId,
      sku_code || null,
      barcode_raw,
      barcode_full,
      name_kr,
      name_en || null,
      volume_ml || null
    ];

    if (availableColumns.has("width_cm")) {
      updateAssignments.push("width_cm = ?");
      updateValues.push(widthCm);
    }
    if (availableColumns.has("length_cm")) {
      updateAssignments.push("length_cm = ?");
      updateValues.push(lengthCm);
    }
    if (availableColumns.has("height_cm")) {
      updateAssignments.push("height_cm = ?");
      updateValues.push(heightCm);
    }
    if (availableColumns.has("cbm_m3")) {
      updateAssignments.push("cbm_m3 = ?");
      updateValues.push(cbmM3);
    }
    if (availableColumns.has("min_storage_fee_month")) {
      updateAssignments.push("min_storage_fee_month = ?");
      updateValues.push(minStorageFeeMonth == null ? 0 : minStorageFeeMonth);
    }

    updateAssignments.push("unit = ?", "status = ?");
    updateValues.push(unit || null, status);
    updateValues.push(req.params.id);

    const [result] = await getPool().query(
      `UPDATE products
       SET ${updateAssignments.join(", ")}
       WHERE id = ? AND deleted_at IS NULL`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Product not found" });
    }

    const productSelectColumns = buildProductSelectColumns(availableColumns);
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
