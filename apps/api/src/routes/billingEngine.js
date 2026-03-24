const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");
const { withTransaction } = require("../services/stock");
const { getScopedClientId } = require("../middleware/clientScope");

const router = express.Router();

const BILLING_UNITS = ["ORDER", "SKU", "BOX", "CBM", "PALLET", "EVENT", "MONTH"];
const PRICING_POLICIES = ["THB_BASED", "KRW_FIXED"];
let hasInvoiceMonthColumnCache = null;
let hasInvoiceDateColumnCache = null;
let hasInvoiceFxRateColumnCache = null;
let hasClientDefaultWarehouseColumnCache = null;
const schemaColumnCache = new Map();
const schemaTableCache = new Map();

function trunc100(input) {
  const value = Number(input || 0);
  return Math.floor(value / 100) * 100;
}

function monthRange(invoiceMonth) {
  const from = `${invoiceMonth}-01`;
  const [year, month] = invoiceMonth.split("-").map(Number);
  const to = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { from, to };
}

function parseCreator(req, payloadCreatedBy) {
  if (payloadCreatedBy) return payloadCreatedBy;
  const authUserId = Number(req.user?.sub || 0);
  return Number.isFinite(authUserId) && authUserId > 0 ? authUserId : 1;
}

function mapBillingBasisFromUnit(unit) {
  if (unit === "ORDER") return "ORDER";
  if (unit === "BOX") return "BOX";
  if (unit === "SKU") return "QTY";
  return "MANUAL";
}

function requireAdmin(req, res) {
  if (req.user?.role !== "admin") {
    res.status(403).json({
      ok: false,
      code: "ADMIN_ONLY",
      message: "This operation requires admin role"
    });
    return false;
  }
  return true;
}

async function getExchangeRateUsageCount(conn, exchangeRateId) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS usage_count
     FROM invoices i
     JOIN exchange_rates er ON er.id = ?
     WHERE i.deleted_at IS NULL
       AND i.invoice_month IS NOT NULL
       AND i.fx_rate_thbkrw = er.rate`,
    [exchangeRateId]
  );
  return Number(rows[0]?.usage_count || 0);
}

async function resolveInvoiceSequence(conn, clientId, yyyymm) {
  const [seqRows] = await conn.query(
    `SELECT id, last_seq
     FROM invoice_sequences
     WHERE client_id = ? AND yyyymm = ? AND deleted_at IS NULL
     LIMIT 1
     FOR UPDATE`,
    [clientId, yyyymm]
  );

  if (seqRows.length === 0) {
    await conn.query(
      `INSERT INTO invoice_sequences (client_id, yyyymm, last_seq)
       VALUES (?, ?, 1)`,
      [clientId, yyyymm]
    );
    return 1;
  }

  const nextSeq = Number(seqRows[0].last_seq) + 1;
  await conn.query("UPDATE invoice_sequences SET last_seq = ? WHERE id = ?", [nextSeq, seqRows[0].id]);
  return nextSeq;
}

function normalizeInvoiceStatus(status) {
  if (!status) return null;
  const value = String(status).toLowerCase();
  if (["draft", "issued", "paid"].includes(value)) return value;
  return null;
}

function formatDisplayDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value, fractionDigits = 0) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
      })
    : "0";
}

async function loadInvoiceDetail(conn, invoiceId, scopedClientId = null) {
  const hasInvoices = await hasTable("invoices", conn);
  if (!hasInvoices) return null;

  const hasInvoiceMonth = await hasInvoiceMonthColumn(conn);
  const hasInvoiceDate = await hasInvoiceDateColumn(conn);
  const hasBillingEvents = await hasTable("billing_events", conn);
  const hasFxRate = await hasColumn("invoices", "fx_rate_thbkrw", conn);
  const hasSubtotal = await hasColumn("invoices", "subtotal_krw", conn);
  const hasVat = await hasColumn("invoices", "vat_krw", conn);
  const hasTotalKrw = await hasColumn("invoices", "total_krw", conn);
  const hasInvoiceItems = await hasTable("invoice_items", conn);

  const monthExpr = invoiceMonthExpr(hasInvoiceMonth, "i");
  const dateExpr = invoiceDateExpr(hasInvoiceDate, "i");
  const subtotalThbExpr = hasBillingEvents
    ? "COALESCE((SELECT SUM(be.amount_thb) FROM billing_events be WHERE be.invoice_id = i.id AND be.deleted_at IS NULL), 0)"
    : "0";
  const fxExpr = hasFxRate ? "i.fx_rate_thbkrw" : "NULL";
  const subtotalExpr = hasSubtotal ? "i.subtotal_krw" : "0";
  const vatExpr = hasVat ? "i.vat_krw" : "0";
  const totalExpr = hasTotalKrw ? "i.total_krw" : "i.total_amount";

  const [invoiceRows] = await conn.query(
    `SELECT i.id, i.client_id, c.client_code, c.name_kr,
            i.invoice_no, ${monthExpr} AS invoice_month, ${dateExpr} AS invoice_date, i.currency,
            ${fxExpr} AS fx_rate_thbkrw, ${subtotalThbExpr} AS subtotal_thb, ${subtotalExpr} AS subtotal_krw, ${vatExpr} AS vat_krw, ${totalExpr} AS total_krw, i.status, i.created_at, i.updated_at,
            (MOD(${subtotalExpr}, 100) = 0) AS subtotal_trunc100,
            (MOD(${vatExpr}, 100) = 0) AS vat_trunc100,
            (MOD(${totalExpr}, 100) = 0) AS total_trunc100
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.id = ? AND i.deleted_at IS NULL
     ${scopedClientId ? "AND i.client_id = ?" : ""}`,
    scopedClientId ? [invoiceId, scopedClientId] : [invoiceId]
  );

  if (invoiceRows.length === 0) return null;

  const [itemRows] = hasInvoiceItems
    ? await conn.query(
        `SELECT id, invoice_id, service_code, description, qty, unit_price_krw, amount_krw, created_at, updated_at,
                (MOD(unit_price_krw, 100) = 0) AS unit_price_trunc100,
                (MOD(amount_krw, 100) = 0) AS amount_trunc100
         FROM invoice_items
         WHERE invoice_id = ? AND deleted_at IS NULL
         ORDER BY id ASC`,
        [invoiceId]
      )
    : [[]];

  return {
    invoice: invoiceRows[0],
    items: itemRows
  };
}

function buildInvoiceHtmlDocument(detail) {
  const { invoice, items } = detail;
  const rowsHtml = items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.service_code)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="num">${formatNumber(item.qty)}</td>
          <td class="num">${formatNumber(item.unit_price_krw)}</td>
          <td class="num">${formatNumber(item.amount_krw)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoice.invoice_no)} Invoice</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: "Segoe UI", "Noto Sans KR", sans-serif; margin: 32px; color: #0f172a; }
      h1, h2, p { margin: 0; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
      .brand { font-size: 28px; font-weight: 700; letter-spacing: 0.04em; }
      .muted { color: #475569; }
      .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
      .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; background: #fff; }
      .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 6px; }
      .value { font-size: 15px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; font-size: 13px; vertical-align: top; }
      th { text-align: left; color: #475569; background: #f8fafc; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .summary { margin-top: 24px; margin-left: auto; width: 320px; }
      .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
      .summary-row.total { font-size: 16px; font-weight: 700; border-top: 2px solid #0f172a; margin-top: 8px; }
      .footer { margin-top: 32px; color: #64748b; font-size: 12px; }
      @media print {
        body { margin: 16px; }
        .card { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">Kowinsblue 3PL</div>
        <p class="muted">Commercial Invoice</p>
      </div>
      <div class="card">
        <div class="label">Invoice No</div>
        <div class="value">${escapeHtml(invoice.invoice_no)}</div>
      </div>
    </div>

    <div class="meta">
      <div class="card">
        <div class="label">Client</div>
        <div class="value">${escapeHtml(invoice.client_code)} / ${escapeHtml(invoice.name_kr)}</div>
      </div>
      <div class="card">
        <div class="label">Invoice Month</div>
        <div class="value">${escapeHtml(invoice.invoice_month)}</div>
      </div>
      <div class="card">
        <div class="label">Invoice Date</div>
        <div class="value">${escapeHtml(formatDisplayDate(invoice.invoice_date))}</div>
      </div>
      <div class="card">
        <div class="label">Status</div>
        <div class="value">${escapeHtml(String(invoice.status).toUpperCase())}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Code</th>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit KRW</th>
          <th class="num">Amount KRW</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div class="summary">
      <div class="summary-row"><span>FX Rate</span><strong>${formatNumber(invoice.fx_rate_thbkrw, 4)}</strong></div>
      <div class="summary-row"><span>Original THB</span><strong>${formatNumber(invoice.subtotal_thb, 2)} THB</strong></div>
      <div class="summary-row"><span>Subtotal</span><strong>${formatNumber(invoice.subtotal_krw)} KRW</strong></div>
      <div class="summary-row"><span>VAT 7%</span><strong>${formatNumber(invoice.vat_krw)} KRW</strong></div>
      <div class="summary-row total"><span>Total</span><strong>${formatNumber(invoice.total_krw)} KRW</strong></div>
    </div>

    <div class="footer">
      Generated from WMS invoice ledger. This printable HTML is intended for immediate browser print-to-PDF workflow and download audit.
    </div>
  </body>
</html>`;
}

const BILLING_DATE_RANGE_MESSAGES = {
  missing: "Please select both start and end dates.",
  invalidOrder: "Start date cannot be later than end date."
};

function normalizeDateFilter(value) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

async function hasInvoiceMonthColumn(conn = getPool()) {
  if (hasInvoiceMonthColumnCache !== null) return hasInvoiceMonthColumnCache;

  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'invoices'
       AND column_name = 'invoice_month'`
  );

  hasInvoiceMonthColumnCache = Number(rows[0]?.cnt || 0) > 0;
  return hasInvoiceMonthColumnCache;
}

function invoiceMonthExpr(hasInvoiceMonthColumn, alias) {
  return hasInvoiceMonthColumn ? `${alias}.invoice_month` : `DATE_FORMAT(${alias}.issue_date, '%Y-%m')`;
}

async function hasInvoiceDateColumn(conn = getPool()) {
  if (hasInvoiceDateColumnCache !== null) return hasInvoiceDateColumnCache;

  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'invoices'
       AND column_name = 'invoice_date'`
  );

  hasInvoiceDateColumnCache = Number(rows[0]?.cnt || 0) > 0;
  return hasInvoiceDateColumnCache;
}

function invoiceDateExpr(hasInvoiceDateColumn, alias) {
  return hasInvoiceDateColumn ? `${alias}.invoice_date` : `${alias}.issue_date`;
}

async function hasInvoiceFxRateColumn(conn = getPool()) {
  if (hasInvoiceFxRateColumnCache !== null) return hasInvoiceFxRateColumnCache;
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'invoices'
       AND column_name = 'fx_rate_thbkrw'`
  );
  hasInvoiceFxRateColumnCache = Number(rows[0]?.cnt || 0) > 0;
  return hasInvoiceFxRateColumnCache;
}

async function hasTable(tableName, conn = getPool()) {
  const key = String(tableName);
  if (schemaTableCache.has(key)) return schemaTableCache.get(key);
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [key]
  );
  const result = Number(rows[0]?.cnt || 0) > 0;
  schemaTableCache.set(key, result);
  return result;
}

async function hasColumn(tableName, columnName, conn = getPool()) {
  const key = `${tableName}.${columnName}`;
  if (schemaColumnCache.has(key)) return schemaColumnCache.get(key);
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [tableName, columnName]
  );
  const result = Number(rows[0]?.cnt || 0) > 0;
  schemaColumnCache.set(key, result);
  return result;
}

async function hasClientDefaultWarehouseColumn(conn = getPool()) {
  if (hasClientDefaultWarehouseColumnCache !== null) return hasClientDefaultWarehouseColumnCache;

  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'clients'
       AND column_name = 'default_warehouse_id'`
  );
  hasClientDefaultWarehouseColumnCache = Number(rows[0]?.cnt || 0) > 0;
  return hasClientDefaultWarehouseColumnCache;
}

async function resolveWarehouseIdFromReference(conn, referenceType, referenceId) {
  if (!referenceId || !referenceType) return null;

  const normalizedType = String(referenceType).toUpperCase();
  if (normalizedType === "OUTBOUND") {
    const [rows] = await conn.query(
      `SELECT warehouse_id
       FROM outbound_orders
       WHERE deleted_at IS NULL
         AND (CAST(id AS CHAR) = ? OR outbound_no = ?)
       ORDER BY id DESC
       LIMIT 1`,
      [String(referenceId), String(referenceId)]
    );
    return rows[0]?.warehouse_id ?? null;
  }
  if (normalizedType === "INBOUND") {
    const [rows] = await conn.query(
      `SELECT warehouse_id
       FROM inbound_orders
       WHERE deleted_at IS NULL
         AND (CAST(id AS CHAR) = ? OR inbound_no = ?)
       ORDER BY id DESC
       LIMIT 1`,
      [String(referenceId), String(referenceId)]
    );
    return rows[0]?.warehouse_id ?? null;
  }
  return null;
}

async function resolveClientDefaultWarehouseId(conn, clientId) {
  const hasColumn = await hasClientDefaultWarehouseColumn(conn);
  if (!hasColumn) return null;
  const [rows] = await conn.query(
    `SELECT default_warehouse_id
     FROM clients
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [clientId]
  );
  return rows[0]?.default_warehouse_id ?? null;
}

async function resolveWarehouseIdForBillingEvent(conn, payload) {
  if (payload.warehouse_id) return Number(payload.warehouse_id);

  const byRef = await resolveWarehouseIdFromReference(conn, payload.reference_type, payload.reference_id);
  if (byRef) return Number(byRef);

  const byClientDefault = await resolveClientDefaultWarehouseId(conn, payload.client_id);
  if (byClientDefault) return Number(byClientDefault);
  return null;
}

const serviceCatalogSchema = z.object({
  service_code: z.string().min(1).max(80),
  service_name: z.string().min(1).max(255),
  billing_unit: z.enum(BILLING_UNITS),
  pricing_policy: z.enum(PRICING_POLICIES),
  default_currency: z.enum(["THB", "KRW"]),
  default_rate: z.coerce.number().nonnegative(),
  status: z.enum(["active", "inactive"]).default("active")
});

const clientRateSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  service_code: z.string().min(1).max(80),
  custom_rate: z.coerce.number().nonnegative(),
  currency: z.enum(["THB", "KRW"]),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const storageRateSettingSchema = z.object({
  warehouse_id: z.coerce.number().int().positive().nullable().optional(),
  client_id: z.coerce.number().int().positive().nullable().optional(),
  rate_cbm: z.coerce.number().nonnegative(),
  rate_pallet: z.coerce.number().nonnegative(),
  currency: z.string().trim().min(1).max(10).default("THB"),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "inactive"]).default("active")
});

const exchangeRateSchema = z.object({
  rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate: z.coerce.number().positive(),
  source: z.enum(["manual", "api"]).default("manual"),
  locked: z.coerce.number().int().min(0).max(1).default(0),
  status: z.enum(["draft", "active", "superseded"]).default("active"),
  entered_by: z.coerce.number().int().positive().optional()
});

const billingEventSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  warehouse_id: z.coerce.number().int().positive().nullable().optional(),
  service_code: z.string().min(1).max(80),
  reference_type: z.string().min(1).max(40),
  reference_id: z.string().max(120).nullable().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qty: z.coerce.number().nonnegative().default(0),
  pricing_policy: z.enum(PRICING_POLICIES),
  unit_price_thb: z.coerce.number().nonnegative().nullable().optional(),
  amount_thb: z.coerce.number().nonnegative().nullable().optional(),
  unit_price_krw: z.coerce.number().nonnegative().nullable().optional(),
  amount_krw: z.coerce.number().nonnegative().nullable().optional()
});

const generateInvoiceSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  invoice_month: z.string().regex(/^\d{4}-\d{2}$/),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  regenerate_draft: z.coerce.number().int().min(0).max(1).default(0),
  created_by: z.coerce.number().int().positive().optional()
});

const markPendingSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1)
});

function buildBillingEventsWhere(query, options = {}) {
  const hasWarehouseId = options.hasWarehouseId !== false;
  const scopedClientId = Number(options.scopedClientId || 0);
  const params = [];
  let where = " WHERE be.deleted_at IS NULL";

  if (scopedClientId > 0) {
    where += " AND be.client_id = ?";
    params.push(scopedClientId);
  } else if (query.client_id) {
    where += " AND be.client_id = ?";
    params.push(Number(query.client_id));
  }
  if (query.status) {
    where += " AND be.status = ?";
    params.push(String(query.status).toUpperCase());
  }
  if (query.service_code) {
    where += " AND be.service_code = ?";
    params.push(String(query.service_code));
  }
  if (hasWarehouseId && query.warehouse_id) {
    where += " AND be.warehouse_id = ?";
    params.push(Number(query.warehouse_id));
  }
  if (query.invoice_month && /^\d{4}-\d{2}$/.test(String(query.invoice_month))) {
    where += " AND DATE_FORMAT(be.event_date, '%Y-%m') = ?";
    params.push(String(query.invoice_month));
  } else if (query.invoice_year && /^\d{4}$/.test(String(query.invoice_year))) {
    where += " AND DATE_FORMAT(be.event_date, '%Y') = ?";
    params.push(String(query.invoice_year));
  }

  return { where, params };
}

router.get("/billing/settings/service-catalog", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const hasServiceName = await hasColumn("service_catalog", "service_name");
    const hasBillingUnit = await hasColumn("service_catalog", "billing_unit");
    const hasPricingPolicy = await hasColumn("service_catalog", "pricing_policy");
    const hasDefaultRate = await hasColumn("service_catalog", "default_rate");

    const serviceNameExpr = hasServiceName ? "COALESCE(service_name, service_name_kr)" : "service_name_kr";
    const billingUnitExpr = hasBillingUnit
      ? "billing_unit"
      : `CASE billing_basis WHEN 'ORDER' THEN 'ORDER' WHEN 'BOX' THEN 'BOX' WHEN 'QTY' THEN 'SKU' ELSE 'EVENT' END`;
    const pricingPolicyExpr = hasPricingPolicy ? "pricing_policy" : "'KRW_FIXED'";
    const defaultRateExpr = hasDefaultRate ? "default_rate" : "0";

    const [rows] = await getPool().query(
      `SELECT id, service_code, ${serviceNameExpr} AS service_name,
              ${billingUnitExpr} AS billing_unit, ${pricingPolicyExpr} AS pricing_policy,
              default_currency, ${defaultRateExpr} AS default_rate, status, created_at, updated_at
       FROM service_catalog
       WHERE deleted_at IS NULL
       ORDER BY service_code ASC`
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/settings/service-catalog", validate(serviceCatalogSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const payload = req.body;
  try {
    await getPool().query(
      `INSERT INTO service_catalog
        (service_code, service_name_kr, service_name, billing_basis, billing_unit, pricing_policy, default_currency, default_rate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.service_code,
        payload.service_name,
        payload.service_name,
        mapBillingBasisFromUnit(payload.billing_unit),
        payload.billing_unit,
        payload.pricing_policy,
        payload.default_currency,
        payload.default_rate,
        payload.status
      ]
    );

    const [rows] = await getPool().query(
      `SELECT id, service_code, COALESCE(service_name, service_name_kr) AS service_name,
              billing_unit, pricing_policy, default_currency, default_rate, status, created_at, updated_at
       FROM service_catalog
       WHERE service_code = ? AND deleted_at IS NULL`,
      [payload.service_code]
    );

    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Duplicate service_code" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});
router.put("/billing/settings/service-catalog/:serviceCode", validate(serviceCatalogSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const payload = req.body;
  try {
    const [result] = await getPool().query(
      `UPDATE service_catalog
       SET service_code = ?, service_name_kr = ?, service_name = ?, billing_basis = ?, billing_unit = ?,
           pricing_policy = ?, default_currency = ?, default_rate = ?, status = ?
       WHERE service_code = ? AND deleted_at IS NULL`,
      [
        payload.service_code,
        payload.service_name,
        payload.service_name,
        mapBillingBasisFromUnit(payload.billing_unit),
        payload.billing_unit,
        payload.pricing_policy,
        payload.default_currency,
        payload.default_rate,
        payload.status,
        req.params.serviceCode
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Service not found" });
    }

    const [rows] = await getPool().query(
      `SELECT id, service_code, COALESCE(service_name, service_name_kr) AS service_name,
              billing_unit, pricing_policy, default_currency, default_rate, status, created_at, updated_at
       FROM service_catalog
       WHERE service_code = ? AND deleted_at IS NULL`,
      [payload.service_code]
    );

    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Duplicate service_code" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/billing/settings/service-catalog/:serviceCode", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [result] = await getPool().query(
      "UPDATE service_catalog SET deleted_at = NOW() WHERE service_code = ? AND deleted_at IS NULL",
      [req.params.serviceCode]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Service not found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/settings/client-contract-rates", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { client_id, service_code } = req.query;
  try {
    const exists = await hasTable("client_contract_rates");
    if (!exists) {
      return res.json({ ok: true, data: [] });
    }

    let query = `SELECT id, client_id, service_code, custom_rate, currency, effective_date, created_at, updated_at
                 FROM client_contract_rates
                 WHERE deleted_at IS NULL`;
    const params = [];

    if (client_id) {
      query += " AND client_id = ?";
      params.push(client_id);
    }
    if (service_code) {
      query += " AND service_code = ?";
      params.push(service_code);
    }

    query += " ORDER BY effective_date DESC, id DESC";
    const [rows] = await getPool().query(query, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/settings/client-contract-rates", validate(clientRateSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const payload = req.body;
  try {
    const [result] = await getPool().query(
      `INSERT INTO client_contract_rates
        (client_id, service_code, custom_rate, currency, effective_date)
       VALUES (?, ?, ?, ?, ?)`,
      [
        payload.client_id,
        payload.service_code,
        payload.custom_rate,
        payload.currency,
        payload.effective_date
      ]
    );

    const [rows] = await getPool().query(
      `SELECT id, client_id, service_code, custom_rate, currency, effective_date, created_at, updated_at
       FROM client_contract_rates
       WHERE id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Duplicate contract rate" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/billing/settings/client-contract-rates/:id", validate(clientRateSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const payload = req.body;
  try {
    const [result] = await getPool().query(
      `UPDATE client_contract_rates
       SET client_id = ?, service_code = ?, custom_rate = ?, currency = ?, effective_date = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        payload.client_id,
        payload.service_code,
        payload.custom_rate,
        payload.currency,
        payload.effective_date,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Contract rate not found" });
    }

    const [rows] = await getPool().query(
      `SELECT id, client_id, service_code, custom_rate, currency, effective_date, created_at, updated_at
       FROM client_contract_rates
       WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Duplicate contract rate" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/billing/settings/client-contract-rates/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [result] = await getPool().query(
      "UPDATE client_contract_rates SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Contract rate not found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/settings/storage-rates", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { warehouse_id, client_id, effective_from } = req.query;
  try {
    const exists = await hasTable("storage_rate_settings");
    if (!exists) {
      return res.json({ ok: true, data: [] });
    }

    let query = `SELECT
                  id,
                  warehouse_id,
                  client_id,
                  rate_cbm,
                  rate_pallet,
                  currency,
                  effective_from,
                  status,
                  created_at,
                  updated_at
                 FROM storage_rate_settings
                 WHERE deleted_at IS NULL`;
    const params = [];

    if (warehouse_id != null && warehouse_id !== "") {
      query += " AND warehouse_id = ?";
      params.push(Number(warehouse_id));
    }
    if (client_id != null && client_id !== "") {
      query += " AND client_id = ?";
      params.push(Number(client_id));
    }
    if (effective_from && /^\d{4}-\d{2}-\d{2}$/.test(String(effective_from))) {
      query += " AND effective_from <= ?";
      params.push(String(effective_from));
    }

    query += ` ORDER BY
                COALESCE(warehouse_id, 0) DESC,
                COALESCE(client_id, 0) DESC,
                effective_from DESC,
                id DESC`;

    const [rows] = await getPool().query(query, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/settings/storage-rates", validate(storageRateSettingSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const exists = await hasTable("storage_rate_settings");
    if (!exists) {
      return res.status(503).json({ ok: false, message: "storage_rate_settings table is not ready" });
    }

    const payload = req.body;
    const [result] = await getPool().query(
      `INSERT INTO storage_rate_settings
        (warehouse_id, client_id, rate_cbm, rate_pallet, currency, effective_from, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.warehouse_id ?? null,
        payload.client_id ?? null,
        payload.rate_cbm,
        payload.rate_pallet,
        payload.currency.toUpperCase(),
        payload.effective_from,
        payload.status
      ]
    );

    const [rows] = await getPool().query(
      `SELECT
        id, warehouse_id, client_id, rate_cbm, rate_pallet, currency, effective_from, status, created_at, updated_at
       FROM storage_rate_settings
       WHERE id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Duplicate storage rate setting" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/billing/settings/storage-rates/:id", validate(storageRateSettingSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const exists = await hasTable("storage_rate_settings");
    if (!exists) {
      return res.status(503).json({ ok: false, message: "storage_rate_settings table is not ready" });
    }

    const payload = req.body;
    const [result] = await getPool().query(
      `UPDATE storage_rate_settings
       SET warehouse_id = ?,
           client_id = ?,
           rate_cbm = ?,
           rate_pallet = ?,
           currency = ?,
           effective_from = ?,
           status = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        payload.warehouse_id ?? null,
        payload.client_id ?? null,
        payload.rate_cbm,
        payload.rate_pallet,
        payload.currency.toUpperCase(),
        payload.effective_from,
        payload.status,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Storage rate setting not found" });
    }

    const [rows] = await getPool().query(
      `SELECT
        id, warehouse_id, client_id, rate_cbm, rate_pallet, currency, effective_from, status, created_at, updated_at
       FROM storage_rate_settings
       WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Duplicate storage rate setting" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/billing/settings/storage-rates/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const exists = await hasTable("storage_rate_settings");
    if (!exists) {
      return res.status(503).json({ ok: false, message: "storage_rate_settings table is not ready" });
    }

    const [result] = await getPool().query(
      "UPDATE storage_rate_settings SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Storage rate setting not found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/settings/exchange-rates", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { month } = req.query;
  try {
    const hasSource = await hasColumn("exchange_rates", "source");
    const hasLocked = await hasColumn("exchange_rates", "locked");
    const hasInvoiceFxRate = await hasInvoiceFxRateColumn();
    const hasInvoiceMonth = await hasInvoiceMonthColumn();

    const sourceExpr = hasSource ? "er.source" : "'manual'";
    const lockedExpr = hasLocked ? "er.locked" : "0";
    const usedInvoiceCountExpr = hasInvoiceFxRate
      ? `(
          SELECT COUNT(*)
          FROM invoices i
          WHERE i.deleted_at IS NULL
            ${hasInvoiceMonth ? "AND i.invoice_month IS NOT NULL" : ""}
            AND i.fx_rate_thbkrw = er.rate
        )`
      : "0";

    let query = `SELECT er.id, er.rate_date, er.base_currency, er.quote_currency, er.rate,
                        ${sourceExpr} AS source, ${lockedExpr} AS locked, er.status,
                        er.created_at, er.updated_at,
                        ${usedInvoiceCountExpr} AS used_invoice_count
                 FROM exchange_rates er
                 WHERE er.deleted_at IS NULL
                   AND er.base_currency = 'THB'
                   AND er.quote_currency = 'KRW'`;
    const params = [];

    if (month && /^\d{4}-\d{2}$/.test(String(month))) {
      query += " AND DATE_FORMAT(er.rate_date, '%Y-%m') = ?";
      params.push(month);
    }

    query += " ORDER BY er.rate_date DESC, er.id DESC";
    const [rows] = await getPool().query(query, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/settings/exchange-rates", validate(exchangeRateSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const payload = req.body;
  const enteredBy = parseCreator(req, payload.entered_by);

  try {
    const [result] = await getPool().query(
      `INSERT INTO exchange_rates
        (rate_date, base_currency, quote_currency, rate, source, locked, status, entered_by)
       VALUES (?, 'THB', 'KRW', ?, ?, ?, ?, ?)`,
      [payload.rate_date, payload.rate, payload.source, payload.locked, payload.status, enteredBy]
    );

    const [rows] = await getPool().query(
      `SELECT id, rate_date, base_currency, quote_currency, rate, source, locked, status, created_at, updated_at,
              0 AS used_invoice_count
       FROM exchange_rates
       WHERE id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Duplicate rate_date for THB/KRW" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});
router.put("/billing/settings/exchange-rates/:id", validate(exchangeRateSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const payload = req.body;
  try {
    const [rows] = await getPool().query(
      `SELECT id, locked FROM exchange_rates WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Exchange rate not found" });
    }

    const usedCount = await getExchangeRateUsageCount(getPool(), req.params.id);
    if (Number(rows[0].locked) === 1 || usedCount > 0) {
      return res.status(409).json({
        ok: false,
        code: "EXCHANGE_RATE_LOCKED",
        message: "Exchange rate is locked/used by invoices and cannot be modified"
      });
    }

    const [result] = await getPool().query(
      `UPDATE exchange_rates
       SET rate_date = ?, rate = ?, source = ?, locked = ?, status = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [payload.rate_date, payload.rate, payload.source, payload.locked, payload.status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Exchange rate not found" });
    }

    const [updated] = await getPool().query(
      `SELECT id, rate_date, base_currency, quote_currency, rate, source, locked, status, created_at, updated_at,
              0 AS used_invoice_count
       FROM exchange_rates
       WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    return res.json({ ok: true, data: updated[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Duplicate rate_date for THB/KRW" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/billing/settings/exchange-rates/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [rows] = await getPool().query(
      `SELECT id, locked FROM exchange_rates WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Exchange rate not found" });
    }

    const usedCount = await getExchangeRateUsageCount(getPool(), req.params.id);
    if (Number(rows[0].locked) === 1 || usedCount > 0) {
      return res.status(409).json({
        ok: false,
        code: "EXCHANGE_RATE_LOCKED",
        message: "Exchange rate is locked/used by invoices and cannot be deleted"
      });
    }

    await getPool().query("UPDATE exchange_rates SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", [req.params.id]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/events", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const exists = await hasTable("billing_events");
    if (!exists) {
      return res.json({ ok: true, data: [], alerts: { missing_warehouse_id: 0 } });
    }

    const hasWarehouseId = await hasColumn("billing_events", "warehouse_id");
    const warehouseExpr = hasWarehouseId ? "be.warehouse_id" : "NULL";
    const { where, params } = buildBillingEventsWhere(req.query, { hasWarehouseId, scopedClientId });
    const [rows] = await getPool().query(
      `SELECT be.id, be.event_date, be.client_id, c.client_code, c.name_kr,
              be.service_code, be.qty, be.amount_thb, be.fx_rate_thbkrw, be.amount_krw,
              be.reference_type, be.reference_id, ${warehouseExpr} AS warehouse_id, be.status, be.invoice_id
       FROM billing_events be
       JOIN clients c ON c.id = be.client_id
       ${where}
       ORDER BY be.event_date DESC, be.id DESC`,
      params
    );
    const alertRows = hasWarehouseId
      ? (
          await getPool().query(
            `SELECT COUNT(*) AS missing_warehouse_id
             FROM billing_events be
             ${where}
             AND be.warehouse_id IS NULL`,
            params
          )
        )[0]
      : [{ missing_warehouse_id: 0 }];
    return res.json({
      ok: true,
      data: rows,
      alerts: {
        missing_warehouse_id: Number(alertRows[0]?.missing_warehouse_id || 0)
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/events/export.csv", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const exists = await hasTable("billing_events");
    if (!exists) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=billing_events.csv");
      const header = "event_date,client,service_code,qty,amount_thb,fx_rate_thbkrw,amount_krw,reference_type,reference_id,warehouse_id,status";
      return res.send(header);
    }

    const hasWarehouseId = await hasColumn("billing_events", "warehouse_id");
    const warehouseExpr = hasWarehouseId ? "be.warehouse_id" : "NULL";
    const { where, params } = buildBillingEventsWhere(req.query, { hasWarehouseId, scopedClientId });
    const [rows] = await getPool().query(
      `SELECT be.event_date, c.client_code, be.service_code, be.qty, be.amount_thb,
              be.fx_rate_thbkrw, be.amount_krw, be.reference_type, be.reference_id, ${warehouseExpr} AS warehouse_id, be.status
       FROM billing_events be
       JOIN clients c ON c.id = be.client_id
       ${where}
       ORDER BY be.event_date DESC, be.id DESC`,
      params
    );

    const header = "event_date,client,service_code,qty,amount_thb,fx_rate_thbkrw,amount_krw,reference_type,reference_id,warehouse_id,status";
    const lines = rows.map((r) => {
      const values = [
        r.event_date,
        r.client_code,
        r.service_code,
        r.qty,
        r.amount_thb,
        r.fx_rate_thbkrw,
        r.amount_krw,
        r.reference_type,
        r.reference_id,
        r.warehouse_id,
        r.status
      ];
      return values
        .map((v) => {
          const s = v === null || v === undefined ? "" : String(v);
          return `"${s.replace(/"/g, "\"\"")}"`;
        })
        .join(",");
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=billing_events.csv");
    return res.send([header, ...lines].join("\n"));
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/events/mark-pending", validate(markPendingSchema), async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const result = await withTransaction(async (conn) => {
      const ids = req.body.ids;

      const [rows] = await conn.query(
        `SELECT be.id, be.invoice_id, i.status AS invoice_status
         FROM billing_events be
         LEFT JOIN invoices i ON i.id = be.invoice_id AND i.deleted_at IS NULL
         WHERE be.id IN (?) AND be.deleted_at IS NULL
         FOR UPDATE`,
        [ids]
      );

      if (rows.length === 0) {
        return { ok: false, code: "EVENTS_NOT_FOUND", message: "No billing events found" };
      }

      const blocked = rows.filter((r) => ["issued", "paid"].includes(String(r.invoice_status || "").toLowerCase()));
      if (blocked.length > 0) {
        return {
          ok: false,
          code: "EVENTS_LOCKED",
          message: "Cannot mark events pending when linked invoice is ISSUED/PAID"
        };
      }

      await conn.query(
        `UPDATE billing_events
         SET status = 'PENDING', invoice_id = NULL, fx_rate_thbkrw = NULL
         WHERE id IN (?) AND deleted_at IS NULL`,
        [ids]
      );

      return { ok: true, data: { updated: rows.length } };
    });

    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/events", validate(billingEventSchema), async (req, res) => {
  const payload = req.body;
  const amountThb = payload.amount_thb ?? (payload.unit_price_thb ?? 0) * (payload.qty ?? 0);
  const amountKrw = payload.amount_krw ?? (payload.unit_price_krw ?? 0) * (payload.qty ?? 0);

  try {
    const hasWarehouseId = await hasColumn("billing_events", "warehouse_id");
    const warehouseId = hasWarehouseId ? await resolveWarehouseIdForBillingEvent(getPool(), payload) : null;
    const [result] = hasWarehouseId
      ? await getPool().query(
          `INSERT INTO billing_events
            (client_id, warehouse_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            payload.client_id,
            warehouseId,
            payload.service_code,
            payload.reference_type,
            payload.reference_id || null,
            payload.event_date,
            payload.qty,
            payload.pricing_policy,
            payload.unit_price_thb || null,
            payload.pricing_policy === "THB_BASED" ? amountThb : null,
            payload.unit_price_krw || null,
            payload.pricing_policy === "KRW_FIXED" ? trunc100(amountKrw) : null
          ]
        )
      : await getPool().query(
          `INSERT INTO billing_events
            (client_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            payload.client_id,
            payload.service_code,
            payload.reference_type,
            payload.reference_id || null,
            payload.event_date,
            payload.qty,
            payload.pricing_policy,
            payload.unit_price_thb || null,
            payload.pricing_policy === "THB_BASED" ? amountThb : null,
            payload.unit_price_krw || null,
            payload.pricing_policy === "KRW_FIXED" ? trunc100(amountKrw) : null
          ]
        );

    const [rows] = await getPool().query(
      `SELECT id, client_id, ${hasWarehouseId ? "warehouse_id" : "NULL AS warehouse_id"}, service_code, reference_type, reference_id, event_date, qty, pricing_policy,
              unit_price_thb, amount_thb, unit_price_krw, amount_krw, fx_rate_thbkrw, invoice_id, status, created_at, updated_at
       FROM billing_events
       WHERE id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});
router.post("/billing/events/sample", async (req, res) => {
  const clientId = Number(req.body?.client_id || 1);
  const warehouseId = req.body?.warehouse_id ? Number(req.body.warehouse_id) : null;
  const month = String(req.body?.invoice_month || "2026-01");
  const dateA = `${month}-03`;
  const dateB = `${month}-07`;
  const sampleSuffix = Date.now();

  try {
    const hasWarehouseId = await hasColumn("billing_events", "warehouse_id");
    const hasStatus = await hasColumn("billing_events", "status");
    let effectiveWarehouseId = warehouseId;

    if (hasWarehouseId && !effectiveWarehouseId) {
      effectiveWarehouseId = await resolveClientDefaultWarehouseId(getPool(), clientId);
      if (!effectiveWarehouseId) {
        const [warehouseRows] = await getPool().query(
          `SELECT id
           FROM warehouses
           WHERE deleted_at IS NULL
           ORDER BY id ASC
           LIMIT 1`
        );
        effectiveWarehouseId = warehouseRows[0]?.id ?? null;
      }
    }

    if (hasWarehouseId && !effectiveWarehouseId) {
      return res.status(400).json({
        ok: false,
        code: "WAREHOUSE_REQUIRED",
        message: "warehouse_id is required to seed sample events"
      });
    }

    if (hasWarehouseId && hasStatus) {
      await getPool().query(
        `INSERT INTO billing_events
          (client_id, warehouse_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, status)
         VALUES
          (?, ?, 'TH_SHIPPING', 'SHIPPING', ?, ?, 1, 'THB_BASED', 120, 120, 'PENDING'),
          (?, ?, 'TH_BOX', 'SHIPPING', ?, ?, 5, 'THB_BASED', 8, 40, 'PENDING'),
          (?, ?, 'OUTBOUND_FEE', 'OUTBOUND', ?, ?, 3, 'KRW_FIXED', NULL, NULL, 'PENDING')`,
        [
          clientId,
          effectiveWarehouseId,
          `SAMPLE-SHP-${sampleSuffix}`,
          dateA,
          clientId,
          effectiveWarehouseId,
          `SAMPLE-BOX-${sampleSuffix}`,
          dateB,
          clientId,
          effectiveWarehouseId,
          `SAMPLE-OUT-${sampleSuffix}`,
          dateB
        ]
      );
    } else if (hasWarehouseId) {
      await getPool().query(
        `INSERT INTO billing_events
          (client_id, warehouse_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb)
         VALUES
          (?, ?, 'TH_SHIPPING', 'SHIPPING', ?, ?, 1, 'THB_BASED', 120, 120),
          (?, ?, 'TH_BOX', 'SHIPPING', ?, ?, 5, 'THB_BASED', 8, 40),
          (?, ?, 'OUTBOUND_FEE', 'OUTBOUND', ?, ?, 3, 'KRW_FIXED', NULL, NULL)`,
        [
          clientId,
          effectiveWarehouseId,
          `SAMPLE-SHP-${sampleSuffix}`,
          dateA,
          clientId,
          effectiveWarehouseId,
          `SAMPLE-BOX-${sampleSuffix}`,
          dateB,
          clientId,
          effectiveWarehouseId,
          `SAMPLE-OUT-${sampleSuffix}`,
          dateB
        ]
      );
    } else if (hasStatus) {
      await getPool().query(
        `INSERT INTO billing_events
          (client_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, status)
         VALUES
          (?, 'TH_SHIPPING', 'SHIPPING', ?, ?, 1, 'THB_BASED', 120, 120, 'PENDING'),
          (?, 'TH_BOX', 'SHIPPING', ?, ?, 5, 'THB_BASED', 8, 40, 'PENDING'),
          (?, 'OUTBOUND_FEE', 'OUTBOUND', ?, ?, 3, 'KRW_FIXED', NULL, NULL, 'PENDING')`,
        [
          clientId,
          `SAMPLE-SHP-${sampleSuffix}`,
          dateA,
          clientId,
          `SAMPLE-BOX-${sampleSuffix}`,
          dateB,
          clientId,
          `SAMPLE-OUT-${sampleSuffix}`,
          dateB
        ]
      );
    } else {
      await getPool().query(
        `INSERT INTO billing_events
          (client_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb)
         VALUES
          (?, 'TH_SHIPPING', 'SHIPPING', ?, ?, 1, 'THB_BASED', 120, 120),
          (?, 'TH_BOX', 'SHIPPING', ?, ?, 5, 'THB_BASED', 8, 40),
          (?, 'OUTBOUND_FEE', 'OUTBOUND', ?, ?, 3, 'KRW_FIXED', NULL, NULL)`,
        [
          clientId,
          `SAMPLE-SHP-${sampleSuffix}`,
          dateA,
          clientId,
          `SAMPLE-BOX-${sampleSuffix}`,
          dateB,
          clientId,
          `SAMPLE-OUT-${sampleSuffix}`,
          dateB
        ]
      );
    }

    await getPool().query(
      `UPDATE billing_events
       SET unit_price_krw = 3500, amount_krw = 10500
       WHERE client_id = ?
         AND reference_id = ?
         AND pricing_policy = 'KRW_FIXED'
         AND deleted_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [clientId, `SAMPLE-OUT-${sampleSuffix}`]
    );

    return res.json({
      ok: true,
      data: {
        client_id: clientId,
        invoice_month: month,
        warehouse_id: effectiveWarehouseId,
        seeded: true,
        inserted_count: 3
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/events/sample/cleanup", async (req, res) => {
  const clientId = Number(req.body?.client_id || 1);
  const month = String(req.body?.invoice_month || "2026-01");
  const [year, monthNum] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to =
    monthNum === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

  try {
    const [result] = await getPool().query(
      `UPDATE billing_events
       SET deleted_at = NOW()
       WHERE client_id = ?
         AND event_date >= ?
         AND event_date < ?
         AND reference_id LIKE 'SAMPLE-%'
         AND invoice_id IS NULL
         AND deleted_at IS NULL`,
      [clientId, from, to]
    );

    return res.json({
      ok: true,
      data: {
        client_id: clientId,
        invoice_month: month,
        removed_count: Number(result.affectedRows || 0)
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/invoices/generate", validate(generateInvoiceSchema), async (req, res) => {
  try {
    const result = await withTransaction(async (conn) => {
      const payload = req.body;
      const createdBy = parseCreator(req, payload.created_by);
      const hasInvoiceDate = await hasInvoiceDateColumn(conn);
      const { from, to } = monthRange(payload.invoice_month);

      const [existingRows] = await conn.query(
        `SELECT id, status
         FROM invoices
         WHERE client_id = ?
           AND invoice_month = ?
           AND deleted_at IS NULL
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE`,
        [payload.client_id, payload.invoice_month]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        if (String(existing.status).toLowerCase() !== "draft") {
          return {
            ok: false,
            code: "INVOICE_ALREADY_ISSUED",
            message: "Generation blocked: month already has non-draft invoice. Use admin duplicate action."
          };
        }

        if (!payload.regenerate_draft) {
          return {
            ok: true,
            data: { invoice_id: existing.id, reused: true }
          };
        }

        await conn.query(
          `UPDATE billing_events
           SET status = 'PENDING', invoice_id = NULL, fx_rate_thbkrw = NULL
           WHERE invoice_id = ? AND deleted_at IS NULL`,
          [existing.id]
        );
        await conn.query("UPDATE invoice_items SET deleted_at = NOW() WHERE invoice_id = ? AND deleted_at IS NULL", [existing.id]);
        await conn.query("UPDATE invoices SET deleted_at = NOW() WHERE id = ?", [existing.id]);
      }

      const [fxRows] = await conn.query(
        `SELECT id, rate
         FROM exchange_rates
         WHERE base_currency = 'THB'
           AND quote_currency = 'KRW'
           AND deleted_at IS NULL
           AND status = 'active'
           AND rate_date <= ?
         ORDER BY rate_date DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [payload.invoice_date]
      );

      if (fxRows.length === 0) {
        return {
          ok: false,
          code: "FX_NOT_FOUND",
          message: "No active THB->KRW rate found on or before invoice_date"
        };
      }

      const fxRateId = Number(fxRows[0].id);
      const fx = Number(fxRows[0].rate);
      await conn.query("UPDATE exchange_rates SET locked = 1 WHERE id = ?", [fxRateId]);

      const [events] = await conn.query(
        `SELECT id, service_code, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw
         FROM billing_events
         WHERE client_id = ?
           AND status = 'PENDING'
           AND deleted_at IS NULL
           AND event_date >= ?
           AND event_date < ?
         ORDER BY id ASC
         FOR UPDATE`,
        [payload.client_id, from, to]
      );

      if (events.length === 0) {
        return {
          ok: false,
          code: "NO_PENDING_EVENTS",
          message: "No pending billing events found for invoice month"
        };
      }

      const yyyymm = payload.invoice_month.replace("-", "");
      const nextSeq = await resolveInvoiceSequence(conn, payload.client_id, yyyymm);
      const invoiceNo = `KRW-${payload.client_id}-${yyyymm}-${String(nextSeq).padStart(4, "0")}`;

      const [invoiceCreated] = hasInvoiceDate
        ? await conn.query(
            `INSERT INTO invoices
              (settlement_batch_id, client_id, invoice_month, invoice_no, status, issue_date, invoice_date, due_date, recipient_email,
               currency, fx_rate_thbkrw, subtotal_krw, vat_krw, total_krw, total_amount, created_by)
             VALUES (NULL, ?, ?, ?, 'draft', ?, ?, ?, NULL, 'KRW', ?, 0, 0, 0, 0, ?)`,
            [
              payload.client_id,
              payload.invoice_month,
              invoiceNo,
              payload.invoice_date,
              payload.invoice_date,
              payload.invoice_date,
              fx,
              createdBy
            ]
          )
        : await conn.query(
            `INSERT INTO invoices
              (settlement_batch_id, client_id, invoice_month, invoice_no, status, issue_date, due_date, recipient_email,
               currency, fx_rate_thbkrw, subtotal_krw, vat_krw, total_krw, total_amount, created_by)
             VALUES (NULL, ?, ?, ?, 'draft', ?, ?, NULL, 'KRW', ?, 0, 0, 0, 0, ?)`,
            [payload.client_id, payload.invoice_month, invoiceNo, payload.invoice_date, payload.invoice_date, fx, createdBy]
          );
      const invoiceId = Number(invoiceCreated.insertId);

      const [serviceNameRows] = await conn.query(
        `SELECT service_code, COALESCE(service_name, service_name_kr) AS service_name
         FROM service_catalog
         WHERE deleted_at IS NULL`
      );
      const serviceNameMap = new Map(serviceNameRows.map((row) => [row.service_code, row.service_name]));
      const grouped = new Map();

      for (const event of events) {
        let normalizedAmount = 0;
        if (event.pricing_policy === "THB_BASED") {
          const amountThb =
            event.amount_thb !== null && event.amount_thb !== undefined
              ? Number(event.amount_thb)
              : Number(event.unit_price_thb || 0) * Number(event.qty || 0);
          normalizedAmount = trunc100(amountThb * fx);
        } else {
          const amountKrw =
            event.amount_krw !== null && event.amount_krw !== undefined
              ? Number(event.amount_krw)
              : Number(event.unit_price_krw || 0) * Number(event.qty || 0);
          normalizedAmount = trunc100(amountKrw);
        }

        await conn.query(
          `UPDATE billing_events
           SET amount_krw = ?, fx_rate_thbkrw = ?, status = 'INVOICED', invoice_id = ?
           WHERE id = ?`,
          [normalizedAmount, fx, invoiceId, event.id]
        );

        if (!grouped.has(event.service_code)) {
          grouped.set(event.service_code, { qty: 0, amount_krw: 0 });
        }
        const current = grouped.get(event.service_code);
        current.qty += Number(event.qty || 0);
        current.amount_krw += Number(normalizedAmount);
      }

      let subtotalKrw = 0;
      for (const [serviceCode, agg] of grouped.entries()) {
        const qty = Number(agg.qty);
        const lineAmount = trunc100(Number(agg.amount_krw));
        subtotalKrw += lineAmount;

        const unitDisplay = qty > 0 ? trunc100(lineAmount / qty) : lineAmount;
        await conn.query(
          `INSERT INTO invoice_items
            (invoice_id, service_code, description, qty, unit_price_krw, amount_krw)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [invoiceId, serviceCode, serviceNameMap.get(serviceCode) || serviceCode, qty, unitDisplay, lineAmount]
        );
      }

      subtotalKrw = trunc100(subtotalKrw);
      const vatKrw = trunc100(subtotalKrw * 0.07);
      const totalKrw = trunc100(subtotalKrw + vatKrw);

      await conn.query(
        `INSERT INTO invoice_items
          (invoice_id, service_code, description, qty, unit_price_krw, amount_krw)
         VALUES (?, 'VAT_7', 'VAT 7%', 1, ?, ?)`,
        [invoiceId, vatKrw, vatKrw]
      );

      await conn.query(
        `UPDATE invoices
         SET subtotal_krw = ?, vat_krw = ?, total_krw = ?, total_amount = ?
         WHERE id = ?`,
        [subtotalKrw, vatKrw, totalKrw, totalKrw, invoiceId]
      );

      const invoiceDateColumn = invoiceDateExpr(hasInvoiceDate, "i");
      const [invoiceRows] = await conn.query(
        `SELECT id, client_id, invoice_no, invoice_month, ${invoiceDateColumn} AS invoice_date, currency, fx_rate_thbkrw,
                subtotal_krw, vat_krw, total_krw, status, created_at, updated_at
         FROM invoices i
         WHERE id = ?`,
        [invoiceId]
      );

      return {
        ok: true,
        data: {
          invoice: invoiceRows[0],
          events_count: events.length,
          reused: false,
          fx_rate_id: fxRateId
        }
      };
    });

    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});
router.post("/billing/invoices/:id/issue", async (req, res) => {
  try {
    const result = await withTransaction(async (conn) => {
      const invoiceId = Number(req.params.id);
      const [rows] = await conn.query(
        `SELECT id, status FROM invoices WHERE id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [invoiceId]
      );
      if (rows.length === 0) return { ok: false, code: "NOT_FOUND", message: "Invoice not found" };
      if (String(rows[0].status).toLowerCase() !== "draft") {
        return { ok: false, code: "INVALID_STATUS", message: "Only DRAFT invoice can be issued" };
      }
      await conn.query("UPDATE invoices SET status = 'issued' WHERE id = ?", [invoiceId]);
      return { ok: true, data: { id: invoiceId, status: "issued" } };
    });
    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/invoices/:id/mark-paid", async (req, res) => {
  try {
    const result = await withTransaction(async (conn) => {
      const invoiceId = Number(req.params.id);
      const [rows] = await conn.query(
        `SELECT id, status FROM invoices WHERE id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [invoiceId]
      );
      if (rows.length === 0) return { ok: false, code: "NOT_FOUND", message: "Invoice not found" };
      if (String(rows[0].status).toLowerCase() !== "issued") {
        return { ok: false, code: "INVALID_STATUS", message: "Only ISSUED invoice can be marked paid" };
      }
      await conn.query("UPDATE invoices SET status = 'paid' WHERE id = ?", [invoiceId]);
      return { ok: true, data: { id: invoiceId, status: "paid" } };
    });
    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/billing/invoices/:id/duplicate-admin", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const result = await withTransaction(async (conn) => {
      const sourceInvoiceId = Number(req.params.id);
      const hasInvoiceDate = await hasInvoiceDateColumn(conn);
      const [invoiceRows] = await conn.query(
        `SELECT id, client_id, invoice_month, status
         FROM invoices
         WHERE id = ? AND deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [sourceInvoiceId]
      );

      if (invoiceRows.length === 0) {
        return { ok: false, code: "NOT_FOUND", message: "Invoice not found" };
      }

      const source = invoiceRows[0];
      if (String(source.status).toLowerCase() === "draft") {
        return { ok: false, code: "INVALID_STATUS", message: "Use generate/regenerate for draft invoice" };
      }

      const yyyymm = String(source.invoice_month).replace("-", "");
      const nextSeq = await resolveInvoiceSequence(conn, source.client_id, yyyymm);
      const newInvoiceNo = `KRW-${source.client_id}-${yyyymm}-${String(nextSeq).padStart(4, "0")}`;

      const [created] = hasInvoiceDate
        ? await conn.query(
            `INSERT INTO invoices
              (settlement_batch_id, client_id, invoice_month, invoice_no, status, issue_date, invoice_date, due_date, recipient_email,
               currency, fx_rate_thbkrw, subtotal_krw, vat_krw, total_krw, total_amount, created_by)
             SELECT NULL, client_id, invoice_month, ?, 'draft', issue_date, invoice_date, due_date, recipient_email,
                    'KRW', fx_rate_thbkrw, subtotal_krw, vat_krw, total_krw, total_krw, created_by
             FROM invoices
             WHERE id = ?`,
            [newInvoiceNo, sourceInvoiceId]
          )
        : await conn.query(
            `INSERT INTO invoices
              (settlement_batch_id, client_id, invoice_month, invoice_no, status, issue_date, due_date, recipient_email,
               currency, fx_rate_thbkrw, subtotal_krw, vat_krw, total_krw, total_amount, created_by)
             SELECT NULL, client_id, invoice_month, ?, 'draft', issue_date, due_date, recipient_email,
                    'KRW', fx_rate_thbkrw, subtotal_krw, vat_krw, total_krw, total_krw, created_by
             FROM invoices
             WHERE id = ?`,
            [newInvoiceNo, sourceInvoiceId]
          );
      const newInvoiceId = Number(created.insertId);

      await conn.query(
        `INSERT INTO invoice_items (invoice_id, service_code, description, qty, unit_price_krw, amount_krw)
         SELECT ?, service_code, description, qty, unit_price_krw, amount_krw
         FROM invoice_items
         WHERE invoice_id = ? AND deleted_at IS NULL`,
        [newInvoiceId, sourceInvoiceId]
      );

      const invoiceDateColumn = invoiceDateExpr(hasInvoiceDate, "i");
      const [newRows] = await conn.query(
        `SELECT id, invoice_no, status, invoice_month, ${invoiceDateColumn} AS invoice_date, fx_rate_thbkrw, subtotal_krw, vat_krw, total_krw
         FROM invoices i
         WHERE id = ?`,
        [newInvoiceId]
      );

      return { ok: true, data: newRows[0] };
    });

    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/invoices", async (req, res) => {
  const scopedClientId = getScopedClientId(req);
  const { client_id, invoice_month, invoice_date_from, invoice_date_to } = req.query;
  const status = normalizeInvoiceStatus(req.query.status);
  const normalizedFromDate = normalizeDateFilter(invoice_date_from);
  const normalizedToDate = normalizeDateFilter(invoice_date_to);

  if ((invoice_date_from || invoice_date_to) && (!normalizedFromDate || !normalizedToDate)) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: BILLING_DATE_RANGE_MESSAGES.missing
    });
  }

  if (normalizedFromDate && normalizedToDate && normalizedFromDate > normalizedToDate) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: BILLING_DATE_RANGE_MESSAGES.invalidOrder
    });
  }

  try {
    const hasInvoices = await hasTable("invoices");
    if (!hasInvoices) {
      return res.json({ ok: true, data: [] });
    }

    const hasInvoiceMonth = await hasInvoiceMonthColumn();
    const hasInvoiceDate = await hasInvoiceDateColumn();
    const hasBillingEvents = await hasTable("billing_events");
    const hasFxRate = await hasColumn("invoices", "fx_rate_thbkrw");
    const hasSubtotal = await hasColumn("invoices", "subtotal_krw");
    const hasVat = await hasColumn("invoices", "vat_krw");
    const hasTotalKrw = await hasColumn("invoices", "total_krw");
    const subtotalThbExpr = hasBillingEvents
      ? "COALESCE((SELECT SUM(be.amount_thb) FROM billing_events be WHERE be.invoice_id = i.id AND be.deleted_at IS NULL), 0)"
      : "0";
    const fxExpr = hasFxRate ? "i.fx_rate_thbkrw" : "NULL";
    const subtotalExpr = hasSubtotal ? "i.subtotal_krw" : "0";
    const vatExpr = hasVat ? "i.vat_krw" : "0";
    const totalExpr = hasTotalKrw ? "i.total_krw" : "i.total_amount";
    const monthExpr = invoiceMonthExpr(hasInvoiceMonth, "i");
    const dateExpr = invoiceDateExpr(hasInvoiceDate, "i");

    let query = `SELECT i.id, i.client_id, c.client_code, c.name_kr,
                        i.invoice_no, ${monthExpr} AS invoice_month, ${dateExpr} AS invoice_date, i.currency,
                        ${fxExpr} AS fx_rate_thbkrw, ${subtotalThbExpr} AS subtotal_thb, ${subtotalExpr} AS subtotal_krw, ${vatExpr} AS vat_krw, ${totalExpr} AS total_krw, i.status, i.created_at
                 FROM invoices i
                 JOIN clients c ON c.id = i.client_id
                 WHERE i.deleted_at IS NULL
                   AND ${monthExpr} IS NOT NULL`;
    const params = [];

    if (scopedClientId) {
      query += " AND i.client_id = ?";
      params.push(scopedClientId);
    } else if (client_id) {
      query += " AND i.client_id = ?";
      params.push(client_id);
    }
    if (invoice_month) {
      query += ` AND ${monthExpr} = ?`;
      params.push(invoice_month);
    }
    if (normalizedFromDate) {
      query += ` AND ${dateExpr} >= ?`;
      params.push(normalizedFromDate);
    }
    if (normalizedToDate) {
      query += ` AND ${dateExpr} <= ?`;
      params.push(normalizedToDate);
    }
    if (status) {
      query += " AND i.status = ?";
      params.push(status);
    }

    query += ` ORDER BY ${monthExpr} DESC, i.id DESC`;
    const [rows] = await getPool().query(query, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/invoices/:id", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const detail = await loadInvoiceDetail(getPool(), Number(req.params.id), scopedClientId);
    if (!detail) {
      return res.status(404).json({ ok: false, message: "Invoice not found" });
    }
    return res.json({ ok: true, data: detail });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/invoices/:id/export-pdf", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const detail = await loadInvoiceDetail(getPool(), Number(req.params.id), scopedClientId);
    if (!detail) {
      return res.status(404).json({ ok: false, message: "Invoice not found" });
    }

    const invoice = detail.invoice;
    const fileName = `${String(invoice.invoice_no).replace(/[^A-Za-z0-9._-]/g, "_")}.html`;
    const shouldDownload = String(req.query.download || "0") === "1";

    if (!shouldDownload) {
      return res.json({
        ok: true,
        data: {
          invoice_id: invoice.id,
          invoice_no: invoice.invoice_no,
          status: "ready",
          message: "Printable invoice HTML is ready for download.",
          file_name: fileName,
          content_type: "text/html",
          download_url: `/billing/invoices/${invoice.id}/export-pdf?download=1`
        }
      });
    }

    const requestedBy = Number(req.user?.sub || 0) > 0 ? Number(req.user?.sub) : null;
    await getPool().query(
      `INSERT INTO invoice_export_logs (invoice_id, export_format, requested_by, file_name, meta_json)
       VALUES (?, 'html', ?, ?, JSON_OBJECT('status', ?, 'invoice_no', ?, 'client_code', ?))`,
      [invoice.id, requestedBy, fileName, invoice.status, invoice.invoice_no, invoice.client_code]
    );

    const html = buildInvoiceHtmlDocument(detail);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(html);

  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/billing/invoices/:id/export-logs", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const detail = await loadInvoiceDetail(getPool(), Number(req.params.id), scopedClientId);
    if (!detail) {
      return res.status(404).json({ ok: false, message: "Invoice not found" });
    }
    const [rows] = await getPool().query(
      `SELECT id, invoice_id, export_format, requested_by, requested_at, file_name, meta_json
       FROM invoice_export_logs
       WHERE invoice_id = ?
       ORDER BY id DESC`,
      [req.params.id]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
