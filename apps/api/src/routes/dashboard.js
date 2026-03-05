const express = require("express");
const { getPool } = require("../db");

const router = express.Router();
const PALLET_CBM = 1.2;
const MIN_SNAPSHOT_DAYS_WARN = 20;
const schemaTableCache = new Map();
const schemaColumnCache = new Map();

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function resolveDate(input, defaultLabel = "today") {
  if (input == null || input === "") {
    return {
      ok: true,
      value: getTodayDate(),
      label: defaultLabel
    };
  }

  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return {
      ok: true,
      value: input,
      label: input
    };
  }

  return {
    ok: false,
    message: "Invalid date format. Use YYYY-MM-DD."
  };
}

function resolveDateRequired(input, fieldName) {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return {
      ok: false,
      message: `Invalid ${fieldName} format. Use YYYY-MM-DD.`
    };
  }

  return {
    ok: true,
    value: input
  };
}

function resolveMonthRequired(input) {
  if (typeof input !== "string" || !/^\d{4}-\d{2}$/.test(input)) {
    return {
      ok: false,
      message: "Invalid month format. Use YYYY-MM."
    };
  }

  return {
    ok: true,
    value: input
  };
}

function parseOptionalPositiveInt(value, fieldName) {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, message: `Invalid ${fieldName}. Use a positive integer.` };
  }

  return { ok: true, value: parsed };
}

function parseOptionalNonNegativeNumber(value, fieldName, defaultValue = 0) {
  if (value == null || value === "") {
    return { ok: true, value: defaultValue };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, message: `Invalid ${fieldName}. Use a number >= 0.` };
  }

  return { ok: true, value: parsed };
}

function toFixedNumber(value, digits = 4) {
  return Number(Number(value || 0).toFixed(digits));
}

function monthStartToMonthEnd(monthStart) {
  const [year, month] = String(monthStart).split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

function monthStartToNextMonthStart(monthStart) {
  const [year, month] = String(monthStart).split("-").map(Number);
  if (month === 12) {
    return `${year + 1}-01-01`;
  }
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

async function hasTable(tableName) {
  const key = String(tableName || "").trim();
  if (!key) return false;
  if (schemaTableCache.has(key)) {
    return schemaTableCache.get(key);
  }

  const [rows] = await getPool().query(
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

async function hasColumn(tableName, columnName) {
  const table = String(tableName || "").trim();
  const column = String(columnName || "").trim();
  if (!table || !column) return false;
  const key = `${table}.${column}`;
  if (schemaColumnCache.has(key)) {
    return schemaColumnCache.get(key);
  }

  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [table, column]
  );
  const result = Number(rows[0]?.cnt || 0) > 0;
  schemaColumnCache.set(key, result);
  return result;
}

async function getCbmSqlParts(alias = "p") {
  const hasCbmM3 = await hasColumn("products", "cbm_m3");
  const hasVolumeMl = await hasColumn("products", "volume_ml");

  let effectiveCbmExpr = "0";
  let missingCbmCondition = "1 = 1";

  if (hasCbmM3 && hasVolumeMl) {
    effectiveCbmExpr = `COALESCE(
      NULLIF(${alias}.cbm_m3, 0),
      CASE
        WHEN ${alias}.volume_ml IS NOT NULL AND ${alias}.volume_ml > 0
        THEN (${alias}.volume_ml / 1000000)
        ELSE 0
      END
    )`;
    missingCbmCondition = `(
      COALESCE(${alias}.cbm_m3, 0) <= 0
      AND (
        ${alias}.volume_ml IS NULL
        OR ${alias}.volume_ml <= 0
      )
    )`;
  } else if (hasCbmM3) {
    effectiveCbmExpr = `COALESCE(NULLIF(${alias}.cbm_m3, 0), 0)`;
    missingCbmCondition = `COALESCE(${alias}.cbm_m3, 0) <= 0`;
  } else if (hasVolumeMl) {
    effectiveCbmExpr = `CASE
      WHEN ${alias}.volume_ml IS NOT NULL AND ${alias}.volume_ml > 0
      THEN (${alias}.volume_ml / 1000000)
      ELSE 0
    END`;
    missingCbmCondition = `(${alias}.volume_ml IS NULL OR ${alias}.volume_ml <= 0)`;
  }

  return { effectiveCbmExpr, missingCbmCondition };
}

function resolveFilters(query = {}, body = {}) {
  const warehouseIdResult = parseOptionalPositiveInt(query.warehouseId ?? body.warehouseId, "warehouseId");
  if (!warehouseIdResult.ok) {
    return warehouseIdResult;
  }

  const clientIdResult = parseOptionalPositiveInt(query.clientId ?? body.clientId, "clientId");
  if (!clientIdResult.ok) {
    return clientIdResult;
  }

  return {
    ok: true,
    value: {
      warehouseId: warehouseIdResult.value,
      clientId: clientIdResult.value
    }
  };
}

function appendSnapshotFilter(where, params, filters, alias = "ss") {
  let nextWhere = where;
  if (filters.warehouseId) {
    nextWhere += ` AND ${alias}.warehouse_id = ?`;
    params.push(filters.warehouseId);
  }
  if (filters.clientId) {
    nextWhere += ` AND ${alias}.client_id = ?`;
    params.push(filters.clientId);
  }
  return nextWhere;
}

function appendInventoryFilter(where, params, filters, alias = "sb") {
  let nextWhere = where;
  if (filters.warehouseId) {
    nextWhere += ` AND ${alias}.warehouse_id = ?`;
    params.push(filters.warehouseId);
  }
  if (filters.clientId) {
    nextWhere += ` AND ${alias}.client_id = ?`;
    params.push(filters.clientId);
  }
  return nextWhere;
}

function resolveGroupBy(input) {
  if (input == null || input === "") {
    return { ok: true, value: "day" };
  }

  const normalized = String(input).toLowerCase();
  if (!["day", "week", "month"].includes(normalized)) {
    return {
      ok: false,
      message: "Invalid groupBy. Use day, week, or month."
    };
  }

  return { ok: true, value: normalized };
}

function periodExpression(groupBy) {
  if (groupBy === "week") {
    return "CONCAT(YEAR(ss.snapshot_date), '-W', LPAD(WEEK(ss.snapshot_date, 1), 2, '0'))";
  }
  if (groupBy === "month") {
    return "DATE_FORMAT(ss.snapshot_date, '%Y-%m')";
  }
  return "DATE_FORMAT(ss.snapshot_date, '%Y-%m-%d')";
}

function getCapacityStatus(usagePctCbm) {
  if (usagePctCbm == null || usagePctCbm < 80) {
    return "ok";
  }
  if (usagePctCbm < 95) {
    return "warn";
  }
  return "critical";
}

async function upsertStorageSnapshots(snapshotDate, filters) {
  const pool = getPool();
  const params = [snapshotDate, PALLET_CBM];
  const { effectiveCbmExpr } = await getCbmSqlParts("p");
  const where = appendInventoryFilter(
    " WHERE sb.deleted_at IS NULL AND p.deleted_at IS NULL AND sb.available_qty > 0",
    params,
    filters
  );

  await pool.query(
    `INSERT INTO storage_snapshots
      (warehouse_id, client_id, snapshot_date, total_cbm, total_pallet, total_sku)
     SELECT
      sb.warehouse_id,
      sb.client_id,
      ? AS snapshot_date,
      ROUND(SUM(sb.available_qty * ${effectiveCbmExpr}), 4) AS total_cbm,
      ROUND(SUM(sb.available_qty * ${effectiveCbmExpr} / ?), 4) AS total_pallet,
      COUNT(DISTINCT sb.product_id) AS total_sku
     FROM stock_balances sb
     JOIN products p ON p.id = sb.product_id
     ${where}
     GROUP BY sb.warehouse_id, sb.client_id
     ON DUPLICATE KEY UPDATE
      total_cbm = VALUES(total_cbm),
      total_pallet = VALUES(total_pallet),
      total_sku = VALUES(total_sku)`,
    params
  );
}

async function fetchMissingCbmAlerts(filters) {
  const pool = getPool();
  const params = [];
  const { missingCbmCondition } = await getCbmSqlParts("p");
  const hasWidthCm = await hasColumn("products", "width_cm");
  const hasLengthCm = await hasColumn("products", "length_cm");
  const hasHeightCm = await hasColumn("products", "height_cm");
  const hasCbmM3 = await hasColumn("products", "cbm_m3");
  const widthSelect = hasWidthCm ? "p.width_cm" : "NULL AS width_cm";
  const lengthSelect = hasLengthCm ? "p.length_cm" : "NULL AS length_cm";
  const heightSelect = hasHeightCm ? "p.height_cm" : "NULL AS height_cm";
  const cbmSelect = hasCbmM3 ? "p.cbm_m3" : "NULL AS cbm_m3";
  const groupBy = [
    "sb.warehouse_id",
    "sb.client_id",
    "p.id",
    "p.sku_code",
    "p.name_kr"
  ];
  if (hasWidthCm) groupBy.push("p.width_cm");
  if (hasLengthCm) groupBy.push("p.length_cm");
  if (hasHeightCm) groupBy.push("p.height_cm");
  if (hasCbmM3) groupBy.push("p.cbm_m3");
  const where = appendInventoryFilter(
    ` WHERE sb.deleted_at IS NULL AND p.deleted_at IS NULL AND sb.available_qty > 0 AND ${missingCbmCondition}`,
    params,
    filters
  );

  const [rows] = await pool.query(
    `SELECT
      sb.warehouse_id,
      sb.client_id,
      p.id AS product_id,
      p.sku_code,
      p.name_kr AS product_name,
      ${widthSelect},
      ${lengthSelect},
      ${heightSelect},
      ${cbmSelect},
      SUM(sb.available_qty) AS available_qty
     FROM stock_balances sb
     JOIN products p ON p.id = sb.product_id
     ${where}
     GROUP BY ${groupBy.join(", ")}
     ORDER BY sb.warehouse_id ASC, sb.client_id ASC, p.id ASC`,
    params
  );

  return rows;
}

async function fetchMissingCbmCountByScope(filters) {
  const pool = getPool();
  const params = [];
  const { missingCbmCondition } = await getCbmSqlParts("p");
  const where = appendInventoryFilter(
    ` WHERE sb.deleted_at IS NULL AND p.deleted_at IS NULL AND sb.available_qty > 0 AND ${missingCbmCondition}`,
    params,
    filters
  );

  const [rows] = await pool.query(
    `SELECT
      sb.warehouse_id,
      sb.client_id,
      COUNT(DISTINCT p.id) AS missing_product_cbm_count
     FROM stock_balances sb
     JOIN products p ON p.id = sb.product_id
     ${where}
     GROUP BY sb.warehouse_id, sb.client_id`,
    params
  );

  const map = new Map();
  for (const row of rows) {
    map.set(
      `${row.warehouse_id}-${row.client_id}`,
      Number(row.missing_product_cbm_count || 0)
    );
  }
  return map;
}

async function resolveStorageRateSettingForScope(monthStart, warehouseId, clientId) {
  const exists = await hasTable("storage_rate_settings");
  if (!exists) {
    return null;
  }

  const monthEnd = monthStartToMonthEnd(monthStart);
  const params = [
    monthEnd,
    warehouseId,
    clientId,
    warehouseId,
    clientId
  ];

  const [rows] = await getPool().query(
    `SELECT
      id,
      warehouse_id,
      client_id,
      rate_cbm,
      rate_pallet,
      currency,
      effective_from
     FROM storage_rate_settings srs
     WHERE srs.deleted_at IS NULL
       AND srs.status = 'active'
       AND srs.effective_from <= ?
       AND (
         (srs.warehouse_id = ? AND srs.client_id = ?)
         OR (srs.warehouse_id = ? AND srs.client_id IS NULL)
         OR (srs.warehouse_id IS NULL AND srs.client_id = ?)
         OR (srs.warehouse_id IS NULL AND srs.client_id IS NULL)
       )
     ORDER BY
       CASE
         WHEN srs.warehouse_id = ? AND srs.client_id = ? THEN 1
         WHEN srs.warehouse_id = ? AND srs.client_id IS NULL THEN 2
         WHEN srs.warehouse_id IS NULL AND srs.client_id = ? THEN 3
         ELSE 4
       END ASC,
       srs.effective_from DESC,
       srs.id DESC
     LIMIT 1`,
    [...params, warehouseId, clientId, warehouseId, clientId]
  );

  if (rows.length === 0) {
    return null;
  }
  return rows[0];
}

async function fetchSkuMonthlyFloorAmount(warehouseId, clientId, rateCbm) {
  const pool = getPool();
  const { effectiveCbmExpr } = await getCbmSqlParts("p");
  const hasMinStorageFee = await hasColumn("products", "min_storage_fee_month");
  const minStorageFeeExpr = hasMinStorageFee ? "COALESCE(p.min_storage_fee_month, 0)" : "0";
  const groupBy = [`p.id`, effectiveCbmExpr];
  if (hasMinStorageFee) {
    groupBy.push("p.min_storage_fee_month");
  }

  const [rows] = await pool.query(
    `SELECT
      p.id AS product_id,
      SUM(sb.available_qty) AS available_qty,
      ${effectiveCbmExpr} AS cbm_m3,
      ${minStorageFeeExpr} AS min_storage_fee_month
     FROM stock_balances sb
     JOIN products p ON p.id = sb.product_id
     WHERE sb.deleted_at IS NULL
       AND p.deleted_at IS NULL
       AND sb.available_qty > 0
       AND sb.warehouse_id = ?
       AND sb.client_id = ?
     GROUP BY ${groupBy.join(", ")}`,
    [warehouseId, clientId]
  );

  let floorAmount = 0;
  for (const row of rows) {
    const availableQty = Number(row.available_qty || 0);
    const cbm = Number(row.cbm_m3 || 0);
    const minFee = Number(row.min_storage_fee_month || 0);
    const calculated = availableQty * cbm * rateCbm;
    floorAmount += Math.max(calculated, minFee);
  }

  return toFixedNumber(floorAmount);
}

async function fetchStorageBreakdown(snapshotDate, filters) {
  const pool = getPool();
  const params = [snapshotDate];
  const where = appendSnapshotFilter(" WHERE ss.snapshot_date = ?", params, filters, "ss");

  const [rows] = await pool.query(
    `SELECT
      ss.warehouse_id,
      ss.client_id,
      ss.snapshot_date,
      ss.total_cbm,
      ss.total_pallet,
      ss.total_sku
     FROM storage_snapshots ss
     ${where}
     ORDER BY ss.warehouse_id ASC, ss.client_id ASC`,
    params
  );

  return rows;
}

async function generateSnapshots(req, res) {
  const dateResult = resolveDate(req.query.date || req.body?.date, getTodayDate());
  if (!dateResult.ok) {
    return res.status(400).json({ ok: false, message: dateResult.message });
  }

  const filtersResult = resolveFilters(req.query, req.body);
  if (!filtersResult.ok) {
    return res.status(400).json({ ok: false, message: filtersResult.message });
  }

  try {
    await upsertStorageSnapshots(dateResult.value, filtersResult.value);
    const missingCbmRows = await fetchMissingCbmAlerts(filtersResult.value);

    return res.json({
      ok: true,
      data: {
        snapshot_date: dateResult.value,
        filters: {
          warehouseId: filtersResult.value.warehouseId,
          clientId: filtersResult.value.clientId
        },
        generated: true,
        alerts: {
          missing_product_cbm_count: missingCbmRows.length,
          missing_product_cbm_items: missingCbmRows
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
}

async function getStorageDashboard(req, res) {
  const dateResult = resolveDate(req.query.date);
  if (!dateResult.ok) {
    return res.status(400).json({ ok: false, message: dateResult.message });
  }

  const filtersResult = resolveFilters(req.query);
  if (!filtersResult.ok) {
    return res.status(400).json({ ok: false, message: filtersResult.message });
  }

  try {
    const filters = filtersResult.value;
    const breakdown = await fetchStorageBreakdown(dateResult.value, filters);

    const totals = breakdown.reduce(
      (acc, row) => {
        acc.total_cbm += Number(row.total_cbm || 0);
        acc.total_pallet += Number(row.total_pallet || 0);
        acc.total_sku += Number(row.total_sku || 0);
        return acc;
      },
      { total_cbm: 0, total_pallet: 0, total_sku: 0 }
    );

    return res.json({
      ok: true,
      date: dateResult.label,
      filters: {
        warehouseId: filters.warehouseId,
        clientId: filters.clientId
      },
      totals: {
        total_cbm: Number(totals.total_cbm.toFixed(4)),
        total_pallet: Number(totals.total_pallet.toFixed(4)),
        total_sku: totals.total_sku
      },
      breakdown
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
}

async function getStorageTrend(req, res) {
  const fromResult = resolveDateRequired(req.query.from, "from");
  if (!fromResult.ok) {
    return res.status(400).json({ ok: false, message: fromResult.message });
  }

  const toResult = resolveDateRequired(req.query.to, "to");
  if (!toResult.ok) {
    return res.status(400).json({ ok: false, message: toResult.message });
  }

  const groupByResult = resolveGroupBy(req.query.groupBy);
  if (!groupByResult.ok) {
    return res.status(400).json({ ok: false, message: groupByResult.message });
  }

  const filtersResult = resolveFilters(req.query);
  if (!filtersResult.ok) {
    return res.status(400).json({ ok: false, message: filtersResult.message });
  }

  try {
    const filters = filtersResult.value;
    const groupBy = groupByResult.value;
    const pool = getPool();
    const params = [fromResult.value, toResult.value];
    const where = appendSnapshotFilter(
      " WHERE ss.snapshot_date BETWEEN ? AND ?",
      params,
      filters,
      "ss"
    );

    const [series] = await pool.query(
      `SELECT
        ${periodExpression(groupBy)} AS period,
        ROUND(SUM(ss.total_cbm), 4) AS total_cbm,
        ROUND(SUM(ss.total_pallet), 4) AS total_pallet,
        SUM(ss.total_sku) AS total_sku
       FROM storage_snapshots ss
       ${where}
       GROUP BY period
       ORDER BY MIN(ss.snapshot_date) ASC`,
      params
    );

    const totals = series.reduce(
      (acc, row) => {
        acc.total_cbm += Number(row.total_cbm || 0);
        acc.total_pallet += Number(row.total_pallet || 0);
        acc.total_sku += Number(row.total_sku || 0);
        return acc;
      },
      { total_cbm: 0, total_pallet: 0, total_sku: 0 }
    );

    return res.json({
      ok: true,
      from: fromResult.value,
      to: toResult.value,
      groupBy,
      filters: {
        warehouseId: filters.warehouseId,
        clientId: filters.clientId
      },
      totals: {
        total_cbm: Number(totals.total_cbm.toFixed(4)),
        total_pallet: Number(totals.total_pallet.toFixed(4)),
        total_sku: totals.total_sku
      },
      series
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
}

async function getStorageBillingPreview(req, res) {
  const monthResult = resolveMonthRequired(req.query.month);
  if (!monthResult.ok) {
    return res.status(400).json({ ok: false, message: monthResult.message });
  }

  const filtersResult = resolveFilters(req.query);
  if (!filtersResult.ok) {
    return res.status(400).json({ ok: false, message: filtersResult.message });
  }

  const rateCbmResult = parseOptionalNonNegativeNumber(req.query.rateCbm, "rateCbm", 0);
  if (!rateCbmResult.ok) {
    return res.status(400).json({ ok: false, message: rateCbmResult.message });
  }

  const ratePalletResult = parseOptionalNonNegativeNumber(req.query.ratePallet, "ratePallet", 0);
  if (!ratePalletResult.ok) {
    return res.status(400).json({ ok: false, message: ratePalletResult.message });
  }

  try {
    const hasRateCbmOverride = req.query.rateCbm != null && req.query.rateCbm !== "";
    const hasRatePalletOverride = req.query.ratePallet != null && req.query.ratePallet !== "";
    const filters = filtersResult.value;
    const month = monthResult.value;
    const monthStart = `${month}-01`;
    const monthEndExclusive = monthStartToNextMonthStart(monthStart);
    const pool = getPool();

    const params = [monthStart, monthEndExclusive];
    const where = appendSnapshotFilter(
      " WHERE ss.snapshot_date >= ? AND ss.snapshot_date < ?",
      params,
      filters,
      "ss"
    );

    const [rawLines] = await pool.query(
      `SELECT
        agg.warehouse_id,
        w.name AS warehouse_name,
        agg.client_id,
        c.name_kr AS client_name,
        COALESCE(sku.sku_count, 0) AS sku_count,
        agg.days_count,
        agg.avg_cbm,
        agg.avg_pallet
       FROM (
         SELECT
          ss.warehouse_id,
          ss.client_id,
          COUNT(DISTINCT ss.snapshot_date) AS days_count,
          ROUND(SUM(ss.total_cbm) / NULLIF(COUNT(DISTINCT ss.snapshot_date), 0), 4) AS avg_cbm,
          ROUND(SUM(ss.total_pallet) / NULLIF(COUNT(DISTINCT ss.snapshot_date), 0), 4) AS avg_pallet
         FROM storage_snapshots ss
         ${where}
         GROUP BY ss.warehouse_id, ss.client_id
       ) agg
       LEFT JOIN warehouses w ON w.id = agg.warehouse_id
       LEFT JOIN clients c ON c.id = agg.client_id
       LEFT JOIN (
         SELECT
          sb.warehouse_id,
          sb.client_id,
          COUNT(DISTINCT sb.product_id) AS sku_count
         FROM stock_balances sb
         WHERE sb.deleted_at IS NULL
           AND sb.available_qty > 0
         GROUP BY sb.warehouse_id, sb.client_id
       ) sku ON sku.warehouse_id = agg.warehouse_id AND sku.client_id = agg.client_id
       ORDER BY agg.warehouse_id ASC, agg.client_id ASC`,
      params
    );

    const missingCbmCountByScope = await fetchMissingCbmCountByScope(filters);

    const lines = [];
    for (const row of rawLines) {
      const warehouseId = Number(row.warehouse_id);
      const clientId = Number(row.client_id);
      const daysCount = Number(row.days_count || 0);
      const avgCbm = Number(row.avg_cbm || 0);
      const avgPallet = Number(row.avg_pallet || 0);
      const scopeKey = `${warehouseId}-${clientId}`;
      const missingCbmCount = Number(missingCbmCountByScope.get(scopeKey) || 0);
      const selectedRate = await resolveStorageRateSettingForScope(monthStart, warehouseId, clientId);

      const rateCbm = hasRateCbmOverride
        ? rateCbmResult.value
        : Number(selectedRate?.rate_cbm || 0);
      const ratePallet = hasRatePalletOverride
        ? ratePalletResult.value
        : Number(selectedRate?.rate_pallet || 0);
      const currency = selectedRate?.currency || "THB";

      const amountCbmRaw = avgCbm * rateCbm;
      const skuMinFloorAmount = await fetchSkuMonthlyFloorAmount(warehouseId, clientId, rateCbm);
      const amountCbm = Math.max(amountCbmRaw, skuMinFloorAmount);
      const amountPallet = avgPallet * ratePallet;
      const amountTotal = amountCbm + amountPallet;
      const warningCodes = [];
      const warningMessages = [];

      if (daysCount < MIN_SNAPSHOT_DAYS_WARN) {
        warningCodes.push("insufficient_snapshot_days");
        warningMessages.push("insufficient snapshot days");
      }
      if (missingCbmCount > 0) {
        warningCodes.push("missing_cbm_values");
        warningMessages.push("missing CBM values");
      }

      lines.push({
        warehouse_id: warehouseId,
        warehouse_name: row.warehouse_name ?? null,
        client_id: clientId,
        client_name: row.client_name ?? null,
        sku_count: Number(row.sku_count || 0),
        days_count: daysCount,
        avg_cbm: toFixedNumber(avgCbm),
        avg_pallet: toFixedNumber(avgPallet),
        rate_cbm: toFixedNumber(rateCbm),
        rate_pallet: toFixedNumber(ratePallet),
        currency,
        amount_cbm_raw: toFixedNumber(amountCbmRaw),
        amount_cbm: toFixedNumber(amountCbm),
        amount_pallet: toFixedNumber(amountPallet),
        amount_total: toFixedNumber(amountTotal),
        sku_min_floor_amount: toFixedNumber(skuMinFloorAmount),
        missing_product_cbm_count: missingCbmCount,
        warning_codes: warningCodes,
        warning_messages: warningMessages
      });
    }

    const summary = lines.reduce(
      (acc, row) => {
        acc.amount_cbm += Number(row.amount_cbm || 0);
        acc.amount_pallet += Number(row.amount_pallet || 0);
        acc.amount_total += Number(row.amount_total || 0);
        if (row.warning_codes?.includes("insufficient_snapshot_days")) {
          acc.insufficient_snapshot_days_count += 1;
        }
        if (row.warning_codes?.includes("missing_cbm_values")) {
          acc.missing_cbm_scope_count += 1;
        }
        return acc;
      },
      {
        amount_total: 0,
        amount_cbm: 0,
        amount_pallet: 0,
        insufficient_snapshot_days_count: 0,
        missing_cbm_scope_count: 0
      }
    );

    return res.json({
      ok: true,
      month,
      rates: {
        rateCbm: hasRateCbmOverride ? rateCbmResult.value : null,
        ratePallet: hasRatePalletOverride ? ratePalletResult.value : null,
        source: hasRateCbmOverride || hasRatePalletOverride ? "query_override" : "storage_rate_settings_priority"
      },
      filters: {
        warehouseId: filters.warehouseId,
        clientId: filters.clientId
      },
      summary: {
        amount_total: Number(summary.amount_total.toFixed(4)),
        amount_cbm: Number(summary.amount_cbm.toFixed(4)),
        amount_pallet: Number(summary.amount_pallet.toFixed(4)),
        insufficient_snapshot_days_count: summary.insufficient_snapshot_days_count,
        missing_cbm_scope_count: summary.missing_cbm_scope_count
      },
      alerts: {
        insufficient_snapshot_days_count: summary.insufficient_snapshot_days_count,
        missing_cbm_scope_count: summary.missing_cbm_scope_count
      },
      lines
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
}

async function getStorageCapacity(req, res) {
  const dateResult = resolveDate(req.query.date);
  if (!dateResult.ok) {
    return res.status(400).json({ ok: false, message: dateResult.message });
  }

  const warehouseIdResult = parseOptionalPositiveInt(req.query.warehouseId, "warehouseId");
  if (!warehouseIdResult.ok) {
    return res.status(400).json({ ok: false, message: warehouseIdResult.message });
  }

  try {
    const pool = getPool();
    const params = [dateResult.value];
    let where = " WHERE w.deleted_at IS NULL";

    if (warehouseIdResult.value) {
      where += " AND w.id = ?";
      params.push(warehouseIdResult.value);
    }

    const [rows] = await pool.query(
      `SELECT
        w.id AS warehouse_id,
        COALESCE(used.used_cbm, 0) AS used_cbm,
        w.capacity_cbm,
        COALESCE(used.used_pallet, 0) AS used_pallet,
        w.capacity_pallet
       FROM warehouses w
       LEFT JOIN (
         SELECT
           ss.warehouse_id,
           ROUND(SUM(ss.total_cbm), 4) AS used_cbm,
           ROUND(SUM(ss.total_pallet), 4) AS used_pallet
         FROM storage_snapshots ss
         WHERE ss.snapshot_date = ?
         GROUP BY ss.warehouse_id
       ) used ON used.warehouse_id = w.id
       ${where}
       ORDER BY w.id ASC`,
      params
    );

    const warehouses = rows.map((row) => {
      const usedCbm = Number(row.used_cbm || 0);
      const usedPallet = Number(row.used_pallet || 0);
      const capacityCbm = row.capacity_cbm == null ? null : Number(row.capacity_cbm);
      const capacityPallet = row.capacity_pallet == null ? null : Number(row.capacity_pallet);
      const usagePctCbm = capacityCbm && capacityCbm > 0 ? Number(((usedCbm / capacityCbm) * 100).toFixed(2)) : null;
      const usagePctPallet = capacityPallet && capacityPallet > 0 ? Number(((usedPallet / capacityPallet) * 100).toFixed(2)) : null;
      const status = getCapacityStatus(usagePctCbm);

      return {
        warehouse_id: row.warehouse_id,
        used_cbm: Number(usedCbm.toFixed(4)),
        capacity_cbm: capacityCbm,
        usage_pct_cbm: usagePctCbm,
        status,
        used_pallet: Number(usedPallet.toFixed(4)),
        capacity_pallet: capacityPallet,
        usage_pct_pallet: usagePctPallet
      };
    });

    return res.json({
      ok: true,
      date: dateResult.label,
      warehouses,
      alerts: warehouses.filter((item) => item.status !== "ok")
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
}

router.post("/storage/snapshots/generate", generateSnapshots);
router.get("/storage", getStorageDashboard);
router.get("/storage/trend", getStorageTrend);
router.get("/storage/billing/preview", getStorageBillingPreview);
router.get("/storage/capacity", getStorageCapacity);

module.exports = {
  router,
  upsertStorageSnapshots
};
