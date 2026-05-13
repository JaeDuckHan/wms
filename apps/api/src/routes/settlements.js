const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");
const { withTransaction } = require("../services/stock");
const { getScopedClientId } = require("../middleware/clientScope");

const router = express.Router();

const generateSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  billing_month: z.string().regex(/^\d{4}-\d{2}$/),
  created_by: z.coerce.number().int().positive(),
  exchange_rate_id: z.coerce.number().int().positive().nullable().optional(),
  is_provisional: z.coerce.number().int().min(0).max(1).default(1)
});

const issueInvoiceSchema = z.object({
  settlement_batch_id: z.coerce.number().int().positive(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipient_email: z.string().email().nullable().optional(),
  created_by: z.coerce.number().int().positive()
});

const closeBatchSchema = z.object({
  closed_by: z.coerce.number().int().positive(),
  reason: z.string().max(2000).nullable().optional()
});

const reopenRequestSchema = z.object({
  requested_by: z.coerce.number().int().positive(),
  reason: z.string().min(1).max(2000)
});

const reopenDecisionSchema = z.object({
  approved_by: z.coerce.number().int().positive(),
  reason: z.string().max(2000).nullable().optional()
});

const schemaColumnCache = new Map();
const schemaTableCache = new Map();

function monthRange(billingMonth) {
  const from = `${billingMonth}-01`;
  const [y, m] = billingMonth.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from, to: next };
}

async function hasTable(tableName, conn = getPool()) {
  if (schemaTableCache.has(tableName)) return schemaTableCache.get(tableName);
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  const exists = Number(rows[0]?.cnt || 0) > 0;
  schemaTableCache.set(tableName, exists);
  return exists;
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
  const exists = Number(rows[0]?.cnt || 0) > 0;
  schemaColumnCache.set(key, exists);
  return exists;
}

async function loadSettlementSourceEvents(conn, clientId, range) {
  const hasBillingEvents = await hasTable("billing_events", conn);
  if (hasBillingEvents) {
    const [billingRows] = await conn.query(
      `SELECT
          be.id,
          sc.id AS service_id,
          COALESCE(sc.service_name_kr, sc.service_name, be.service_code) AS description,
          be.service_code,
          CASE
            WHEN sc.billing_unit = 'SKU' THEN 'QTY'
            WHEN sc.billing_unit IS NOT NULL THEN sc.billing_unit
            ELSE 'MANUAL'
          END AS basis,
          be.qty,
          COALESCE(be.unit_price_krw, be.unit_price_thb, 0) AS unit_price,
          CASE
            WHEN be.pricing_policy = 'THB_BASED' THEN 'THB'
            ELSE 'KRW'
          END AS currency,
          COALESCE(be.amount_krw, 0) AS amount_krw,
          COALESCE(be.amount_thb, 0) AS amount_thb,
          'billing_event' AS source_kind
       FROM billing_events be
       LEFT JOIN service_catalog sc ON sc.service_code = be.service_code AND sc.deleted_at IS NULL
       WHERE be.client_id = ?
         AND be.deleted_at IS NULL
         AND be.event_date >= ?
         AND be.event_date < ?
       ORDER BY be.event_date ASC, be.id ASC`,
      [clientId, range.from, range.to]
    );
    if (billingRows.length > 0) return billingRows;
  }

  const [serviceRows] = await conn.query(
    `SELECT
        se.id,
        se.service_id,
        COALESCE(sc.service_name_kr, sc.service_name, 'Service') AS description,
        sc.service_code,
        se.basis_applied AS basis,
        se.qty,
        se.unit_price,
        se.currency,
        0 AS amount_krw,
        COALESCE(se.amount, 0) AS amount_thb,
        'service_event' AS source_kind
     FROM service_events se
     LEFT JOIN service_catalog sc ON sc.id = se.service_id
     WHERE se.client_id = ?
       AND se.deleted_at IS NULL
       AND se.event_date >= ?
       AND se.event_date < ?
     ORDER BY se.event_date ASC, se.id ASC`,
    [clientId, range.from, range.to]
  );
  return serviceRows;
}

function toInvoiceLineUnit(line) {
  const qty = Number(line.qty || 0);
  if (qty <= 0) return Number(line.total_amount || line.amount || 0);
  return Number(line.total_amount || line.amount || 0) / qty;
}

async function resolveFx(conn, payload, rangeTo) {
  if (payload.exchange_rate_id) {
    const [rows] = await conn.query(
      `SELECT id, base_currency, quote_currency, rate
       FROM exchange_rates
       WHERE id = ? AND status = 'active' AND deleted_at IS NULL
       LIMIT 1`,
      [payload.exchange_rate_id]
    );
    return rows[0] || null;
  }

  const [rows] = await conn.query(
    `SELECT id, base_currency, quote_currency, rate
     FROM exchange_rates
     WHERE status = 'active'
       AND deleted_at IS NULL
       AND base_currency = 'THB'
       AND quote_currency = 'KRW'
       AND rate_date < ?
     ORDER BY rate_date DESC, id DESC
     LIMIT 1`,
    [rangeTo]
  );
  return rows[0] || null;
}

router.post("/settlement-batches/generate", validate(generateSchema), async (req, res) => {
  try {
    const result = await withTransaction(async (conn) => {
      const payload = req.body;
      const range = monthRange(payload.billing_month);

      const fx = await resolveFx(conn, payload, range.to);
      if (!fx) {
        return {
          ok: false,
          code: "FX_NOT_FOUND",
          message: "Active THB->KRW exchange rate not found for this period"
        };
      }

      const [existing] = await conn.query(
        `SELECT id
         FROM settlement_batches
         WHERE client_id = ? AND billing_month = ? AND deleted_at IS NULL
         LIMIT 1`,
        [payload.client_id, payload.billing_month]
      );

      let batchId;
      if (existing.length === 0) {
        const [created] = await conn.query(
          `INSERT INTO settlement_batches
            (client_id, billing_month, exchange_rate_id, status, is_provisional, created_by)
           VALUES (?, ?, ?, 'calculating', ?, ?)`,
          [payload.client_id, payload.billing_month, fx.id, payload.is_provisional, payload.created_by]
        );
        batchId = created.insertId;
      } else {
        batchId = existing[0].id;
        await conn.query(
          `UPDATE settlement_batches
           SET exchange_rate_id = ?, status = 'calculating', is_provisional = ?, created_by = ?, deleted_at = NULL
           WHERE id = ?`,
          [fx.id, payload.is_provisional, payload.created_by, batchId]
        );
        await conn.query(
          "UPDATE settlement_lines SET deleted_at = NOW() WHERE settlement_batch_id = ? AND deleted_at IS NULL",
          [batchId]
        );
      }

      const events = await loadSettlementSourceEvents(conn, payload.client_id, range);

      let krwSubtotal = 0;
      let thbSubtotal = 0;

      for (const ev of events) {
        const amountKrw = Number(ev.amount_krw || 0);
        const amountThb = Number(ev.amount_thb || 0);
        if (amountKrw > 0) krwSubtotal += amountKrw;
        if (amountThb > 0) thbSubtotal += amountThb;
        const lineCurrency = amountKrw > 0 ? "KRW" : "THB";
        const lineAmount = lineCurrency === "KRW" ? amountKrw : amountThb;

        await conn.query(
          `INSERT INTO settlement_lines
            (settlement_batch_id, service_id, line_type, description, basis, qty, unit_price, currency, amount, extra_amount, total_amount, source_service_event_id)
           VALUES (?, ?, 'service', ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            batchId,
            ev.service_id || null,
            ev.description || ev.service_code || "Service",
            ev.basis || "MANUAL",
            ev.qty,
            ev.unit_price,
            lineCurrency,
            lineAmount,
            lineAmount,
            ev.source_kind === "service_event" ? ev.id : null
          ]
        );
      }

      const totalKrw = Number((krwSubtotal + thbSubtotal * Number(fx.rate)).toFixed(4));
      await conn.query(
        `UPDATE settlement_batches
         SET krw_subtotal = ?, thb_subtotal = ?, total_krw = ?, status = 'reviewed'
         WHERE id = ?`,
        [krwSubtotal, thbSubtotal, totalKrw, batchId]
      );

      const [batchRows] = await conn.query(
        `SELECT id, client_id, billing_month, exchange_rate_id, status, is_provisional, krw_subtotal, thb_subtotal, total_krw, created_at, updated_at
         FROM settlement_batches
         WHERE id = ?`,
        [batchId]
      );

      return {
        ok: true,
        data: {
          batch: batchRows[0],
          lines_count: events.length
        }
      };
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/settlement-batches/:id", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const [batchRows] = await getPool().query(
      `SELECT id, client_id, billing_month, exchange_rate_id, status, is_provisional, krw_subtotal, thb_subtotal, total_krw, created_at, updated_at
       FROM settlement_batches
       WHERE id = ? AND deleted_at IS NULL
       ${scopedClientId ? "AND client_id = ?" : ""}`,
      scopedClientId ? [req.params.id, scopedClientId] : [req.params.id]
    );
    if (batchRows.length === 0) {
      return res.status(404).json({ ok: false, message: "Settlement batch not found" });
    }

    const [lineRows] = await getPool().query(
      `SELECT id, settlement_batch_id, service_id, line_type, description, basis, qty, unit_price, currency, amount, extra_amount, total_amount, source_service_event_id, created_at, updated_at
       FROM settlement_lines
       WHERE settlement_batch_id = ? AND deleted_at IS NULL
       ORDER BY id ASC`,
      [req.params.id]
    );

    return res.json({
      ok: true,
      data: {
        batch: batchRows[0],
        lines: lineRows
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/invoices/issue", validate(issueInvoiceSchema), async (req, res) => {
  try {
    const result = await withTransaction(async (conn) => {
      const payload = req.body;
      const hasInvoiceMonth = await hasColumn("invoices", "invoice_month", conn);
      const hasInvoiceDate = await hasColumn("invoices", "invoice_date", conn);
      const hasFxRate = await hasColumn("invoices", "fx_rate_thbkrw", conn);
      const hasSubtotalKrw = await hasColumn("invoices", "subtotal_krw", conn);
      const hasVatKrw = await hasColumn("invoices", "vat_krw", conn);
      const hasTotalKrw = await hasColumn("invoices", "total_krw", conn);
      const hasInvoiceItems = await hasTable("invoice_items", conn);

      const [batchRows] = await conn.query(
        `SELECT id, client_id, billing_month, exchange_rate_id, krw_subtotal, thb_subtotal, total_krw
         FROM settlement_batches
         WHERE id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [payload.settlement_batch_id]
      );
      if (batchRows.length === 0) {
        return { ok: false, code: "BATCH_NOT_FOUND", message: "Settlement batch not found" };
      }
      const batch = batchRows[0];

      const [existingInvoice] = await conn.query(
        `SELECT id, invoice_no, status, issue_date, due_date, recipient_email, currency,
                COALESCE(total_krw, total_amount) AS total_amount
         FROM invoices
         WHERE settlement_batch_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [batch.id]
      );
      if (existingInvoice.length > 0) {
        return {
          ok: true,
          data: {
            invoice: existingInvoice[0],
            lines_count: 0,
            reused: true
          }
        };
      }

      const yyyymm = String(batch.billing_month).replace("-", "");
      const [seqRows] = await conn.query(
        `SELECT id, last_seq
         FROM invoice_sequences
         WHERE client_id = ? AND yyyymm = ? AND deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [batch.client_id, yyyymm]
      );

      let nextSeq;
      if (seqRows.length === 0) {
        nextSeq = 1;
        await conn.query(
          `INSERT INTO invoice_sequences (client_id, yyyymm, last_seq)
           VALUES (?, ?, ?)`,
          [batch.client_id, yyyymm, nextSeq]
        );
      } else {
        nextSeq = Number(seqRows[0].last_seq) + 1;
        await conn.query(
          "UPDATE invoice_sequences SET last_seq = ? WHERE id = ?",
          [nextSeq, seqRows[0].id]
        );
      }

      const invoiceNo = `INV-${batch.client_id}-${yyyymm}-${String(nextSeq).padStart(4, "0")}`;
      const [fxRows] = batch.exchange_rate_id
        ? await conn.query(
            `SELECT rate
             FROM exchange_rates
             WHERE id = ? AND deleted_at IS NULL
             LIMIT 1`,
            [batch.exchange_rate_id]
          )
        : [[]];
      const fxRate = Number(fxRows[0]?.rate || 0);
      const subtotalKrw = Number(batch.krw_subtotal || 0) + Number(Number(batch.thb_subtotal || 0) * fxRate);
      const vatKrw = Math.floor(subtotalKrw * 0.07);
      const totalKrw = Number(batch.total_krw || subtotalKrw + vatKrw);

      const invoiceColumns = [
        "settlement_batch_id",
        "client_id",
        "invoice_no",
        "status",
        "issue_date",
        "due_date",
        "recipient_email",
        "currency",
        "total_amount",
        "created_by"
      ];
      const invoiceValues = [
        batch.id,
        batch.client_id,
        invoiceNo,
        "issued",
        payload.issue_date,
        payload.due_date,
        payload.recipient_email || null,
        "KRW",
        totalKrw,
        payload.created_by
      ];
      if (hasInvoiceMonth) {
        invoiceColumns.splice(2, 0, "invoice_month");
        invoiceValues.splice(2, 0, batch.billing_month);
      }
      if (hasInvoiceDate) {
        invoiceColumns.splice(5, 0, "invoice_date");
        invoiceValues.splice(5, 0, payload.issue_date);
      }
      if (hasFxRate) {
        invoiceColumns.splice(invoiceColumns.length - 2, 0, "fx_rate_thbkrw");
        invoiceValues.splice(invoiceValues.length - 2, 0, fxRate);
      }
      if (hasSubtotalKrw) {
        invoiceColumns.splice(invoiceColumns.length - 2, 0, "subtotal_krw");
        invoiceValues.splice(invoiceValues.length - 2, 0, subtotalKrw);
      }
      if (hasVatKrw) {
        invoiceColumns.splice(invoiceColumns.length - 2, 0, "vat_krw");
        invoiceValues.splice(invoiceValues.length - 2, 0, vatKrw);
      }
      if (hasTotalKrw) {
        invoiceColumns.splice(invoiceColumns.length - 2, 0, "total_krw");
        invoiceValues.splice(invoiceValues.length - 2, 0, totalKrw);
      }

      const placeholders = invoiceColumns.map(() => "?").join(", ");
      const [invoiceCreated] = await conn.query(
        `INSERT INTO invoices (${invoiceColumns.join(", ")})
         VALUES (${placeholders})`,
        invoiceValues
      );
      const invoiceId = invoiceCreated.insertId;

      const [settlementLines] = await conn.query(
        `SELECT id, service_id, line_type, description, qty, basis, currency, unit_price, amount, extra_amount, total_amount
         FROM settlement_lines
         WHERE settlement_batch_id = ? AND deleted_at IS NULL
         ORDER BY id ASC`,
        [batch.id]
      );

      for (const line of settlementLines) {
        await conn.query(
          `INSERT INTO invoice_lines
            (invoice_id, settlement_line_id, service_id, line_type, description, qty, unit, currency, unit_price, amount, extra_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            line.id,
            line.service_id,
            line.line_type,
            line.description,
            line.qty,
            line.basis,
            line.currency,
            line.unit_price,
            line.amount,
            line.extra_amount,
            line.total_amount
          ]
        );
        if (hasInvoiceItems) {
          await conn.query(
            `INSERT INTO invoice_items
              (invoice_id, service_code, description, qty, unit_price_krw, amount_krw)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              invoiceId,
              line.service_id ? String(line.service_id) : line.line_type || "service",
              line.description,
              Number(line.qty || 0),
              toInvoiceLineUnit(line),
              Number(line.total_amount || line.amount || 0)
            ]
          );
        }
      }

      const [invoiceRows] = await conn.query(
        `SELECT id, settlement_batch_id, client_id, invoice_no, status, issue_date, due_date, recipient_email, currency,
                COALESCE(total_krw, total_amount) AS total_amount, created_at, updated_at
         FROM invoices
         WHERE id = ?`,
        [invoiceId]
      );

      return {
        ok: true,
        data: {
          invoice: invoiceRows[0],
          lines_count: settlementLines.length,
          reused: false
        }
      };
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const hasInvoiceLines = await hasTable("invoice_lines");
    const hasInvoiceItems = await hasTable("invoice_items");
    const [invoiceRows] = await getPool().query(
      `SELECT id, settlement_batch_id, client_id, invoice_no, status, issue_date, due_date, recipient_email, currency,
              COALESCE(total_krw, total_amount) AS total_amount, created_at, updated_at
       FROM invoices
       WHERE id = ? AND deleted_at IS NULL
       ${scopedClientId ? "AND client_id = ?" : ""}`,
      scopedClientId ? [req.params.id, scopedClientId] : [req.params.id]
    );
    if (invoiceRows.length === 0) {
      return res.status(404).json({ ok: false, message: "Invoice not found" });
    }

    const [lineRows] = hasInvoiceLines
      ? await getPool().query(
          `SELECT id, invoice_id, settlement_line_id, service_id, line_type, description, qty, unit, currency, unit_price, amount, extra_amount, total_amount, created_at, updated_at
           FROM invoice_lines
           WHERE invoice_id = ? AND deleted_at IS NULL
           ORDER BY id ASC`,
          [req.params.id]
        )
      : hasInvoiceItems
        ? await getPool().query(
            `SELECT id, invoice_id, NULL AS settlement_line_id, NULL AS service_id, 'service' AS line_type,
                    description, qty, 'MANUAL' AS unit, 'KRW' AS currency,
                    unit_price_krw AS unit_price, amount_krw AS amount, 0 AS extra_amount, amount_krw AS total_amount,
                    created_at, updated_at
             FROM invoice_items
             WHERE invoice_id = ? AND deleted_at IS NULL
             ORDER BY id ASC`,
            [req.params.id]
          )
        : [[]];

    return res.json({
      ok: true,
      data: {
        invoice: invoiceRows[0],
        lines: lineRows
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post(
  "/settlement-batches/:id/close",
  validate(closeBatchSchema),
  async (req, res) => {
    try {
      const result = await withTransaction(async (conn) => {
        const batchId = Number(req.params.id);
        const payload = req.body;

        const [rows] = await conn.query(
          `SELECT id, status
           FROM settlement_batches
           WHERE id = ? AND deleted_at IS NULL
           LIMIT 1
           FOR UPDATE`,
          [batchId]
        );
        if (rows.length === 0) {
          return {
            ok: false,
            code: "BATCH_NOT_FOUND",
            message: "Settlement batch not found"
          };
        }

        if (rows[0].status === "closed") {
          return {
            ok: false,
            code: "ALREADY_CLOSED",
            message: "Settlement batch is already closed"
          };
        }

        if (!["reviewed", "open"].includes(rows[0].status)) {
          return {
            ok: false,
            code: "INVALID_STATUS",
            message: "Only reviewed/open batch can be closed"
          };
        }

        await conn.query(
          `UPDATE settlement_batches
           SET status = 'closed', closed_at = NOW(), closed_by = ?
           WHERE id = ?`,
          [payload.closed_by, batchId]
        );

        await conn.query(
          `INSERT INTO settlement_reopen_logs
            (settlement_batch_id, request_id, actor_id, action, reason, acted_at)
           VALUES (?, NULL, ?, 'close', ?, NOW())`,
          [batchId, payload.closed_by, payload.reason || null]
        );

        const [batchRows] = await conn.query(
          `SELECT id, status, closed_at, closed_by, updated_at
           FROM settlement_batches
           WHERE id = ?`,
          [batchId]
        );

        return { ok: true, data: batchRows[0] };
      });

      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  }
);

router.post(
  "/settlement-batches/:id/reopen-requests",
  validate(reopenRequestSchema),
  async (req, res) => {
    try {
      const result = await withTransaction(async (conn) => {
        const batchId = Number(req.params.id);
        const payload = req.body;

        const [batchRows] = await conn.query(
          `SELECT id, status
           FROM settlement_batches
           WHERE id = ? AND deleted_at IS NULL
           LIMIT 1
           FOR UPDATE`,
          [batchId]
        );
        if (batchRows.length === 0) {
          return {
            ok: false,
            code: "BATCH_NOT_FOUND",
            message: "Settlement batch not found"
          };
        }

        if (batchRows[0].status !== "closed") {
          return {
            ok: false,
            code: "INVALID_STATUS",
            message: "Only closed batch can request reopen"
          };
        }

        const [pendingRows] = await conn.query(
          `SELECT id
           FROM settlement_reopen_requests
           WHERE settlement_batch_id = ? AND status = 'requested' AND deleted_at IS NULL
           LIMIT 1`,
          [batchId]
        );
        if (pendingRows.length > 0) {
          return {
            ok: false,
            code: "REQUEST_EXISTS",
            message: "Pending reopen request already exists"
          };
        }

        const [created] = await conn.query(
          `INSERT INTO settlement_reopen_requests
            (settlement_batch_id, requested_by, reason, status)
           VALUES (?, ?, ?, 'requested')`,
          [batchId, payload.requested_by, payload.reason]
        );

        const [rows] = await conn.query(
          `SELECT id, settlement_batch_id, requested_by, reason, status, approved_by, approved_at, created_at, updated_at
           FROM settlement_reopen_requests
           WHERE id = ?`,
          [created.insertId]
        );
        return { ok: true, data: rows[0] };
      });

      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.status(201).json(result);
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  }
);

router.get("/settlement-batches/:id/reopen-requests", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const [rows] = await getPool().query(
      `SELECT id, settlement_batch_id, requested_by, reason, status, approved_by, approved_at, created_at, updated_at
       FROM settlement_reopen_requests
       WHERE settlement_batch_id = ? AND deleted_at IS NULL
       ${
         scopedClientId
           ? "AND settlement_batch_id IN (SELECT id FROM settlement_batches WHERE client_id = ? AND deleted_at IS NULL)"
           : ""
       }
       ORDER BY id DESC`,
      scopedClientId ? [req.params.id, scopedClientId] : [req.params.id]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post(
  "/settlement-reopen-requests/:id/approve",
  validate(reopenDecisionSchema),
  async (req, res) => {
    try {
      const result = await withTransaction(async (conn) => {
        const requestId = Number(req.params.id);
        const payload = req.body;

        const [reqRows] = await conn.query(
          `SELECT id, settlement_batch_id, reason, status
           FROM settlement_reopen_requests
           WHERE id = ? AND deleted_at IS NULL
           LIMIT 1
           FOR UPDATE`,
          [requestId]
        );
        if (reqRows.length === 0) {
          return {
            ok: false,
            code: "REQUEST_NOT_FOUND",
            message: "Reopen request not found"
          };
        }

        if (reqRows[0].status !== "requested") {
          return {
            ok: false,
            code: "INVALID_STATUS",
            message: "Only requested status can be approved"
          };
        }

        await conn.query(
          `UPDATE settlement_reopen_requests
           SET status = 'approved', approved_by = ?, approved_at = NOW()
           WHERE id = ?`,
          [payload.approved_by, requestId]
        );

        await conn.query(
          `UPDATE settlement_batches
           SET status = 'reviewed', closed_at = NULL, closed_by = NULL
           WHERE id = ?`,
          [reqRows[0].settlement_batch_id]
        );

        await conn.query(
          `INSERT INTO settlement_reopen_logs
            (settlement_batch_id, request_id, actor_id, action, reason, acted_at)
           VALUES (?, ?, ?, 'reopen', ?, NOW())`,
          [
            reqRows[0].settlement_batch_id,
            requestId,
            payload.approved_by,
            payload.reason || reqRows[0].reason || null
          ]
        );

        const [rows] = await conn.query(
          `SELECT id, settlement_batch_id, requested_by, reason, status, approved_by, approved_at, created_at, updated_at
           FROM settlement_reopen_requests
           WHERE id = ?`,
          [requestId]
        );
        return { ok: true, data: rows[0] };
      });

      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  }
);

router.post(
  "/settlement-reopen-requests/:id/reject",
  validate(reopenDecisionSchema),
  async (req, res) => {
    try {
      const result = await withTransaction(async (conn) => {
        const requestId = Number(req.params.id);
        const payload = req.body;

        const [reqRows] = await conn.query(
          `SELECT id, settlement_batch_id, status
           FROM settlement_reopen_requests
           WHERE id = ? AND deleted_at IS NULL
           LIMIT 1
           FOR UPDATE`,
          [requestId]
        );
        if (reqRows.length === 0) {
          return {
            ok: false,
            code: "REQUEST_NOT_FOUND",
            message: "Reopen request not found"
          };
        }

        if (reqRows[0].status !== "requested") {
          return {
            ok: false,
            code: "INVALID_STATUS",
            message: "Only requested status can be rejected"
          };
        }

        await conn.query(
          `UPDATE settlement_reopen_requests
           SET status = 'rejected', approved_by = ?, approved_at = NOW()
           WHERE id = ?`,
          [payload.approved_by, requestId]
        );

        const [rows] = await conn.query(
          `SELECT id, settlement_batch_id, requested_by, reason, status, approved_by, approved_at, created_at, updated_at
           FROM settlement_reopen_requests
           WHERE id = ?`,
          [requestId]
        );
        return { ok: true, data: rows[0] };
      });

      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  }
);

router.get("/settlement-batches/:id/reopen-logs", async (req, res) => {
  try {
    const scopedClientId = getScopedClientId(req);
    const [rows] = await getPool().query(
      `SELECT id, settlement_batch_id, request_id, actor_id, action, reason, acted_at, created_at, updated_at
       FROM settlement_reopen_logs
       WHERE settlement_batch_id = ? AND deleted_at IS NULL
       ${
         scopedClientId
           ? "AND settlement_batch_id IN (SELECT id FROM settlement_batches WHERE client_id = ? AND deleted_at IS NULL)"
           : ""
       }
       ORDER BY id DESC`,
      scopedClientId ? [req.params.id, scopedClientId] : [req.params.id]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
