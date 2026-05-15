const { getPool } = require("../db");

async function getOutboundOrderForBilling(conn, outboundOrderId) {
  const [rows] = await conn.query(
    `SELECT id, client_id, warehouse_id, order_date, status, shipped_at
     FROM outbound_orders
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [outboundOrderId]
  );
  return rows[0] || null;
}

async function getInboundOrderForBilling(conn, inboundOrderId) {
  const [rows] = await conn.query(
    `SELECT id, client_id, warehouse_id, inbound_date, status, received_at
     FROM inbound_orders
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [inboundOrderId]
  );
  return rows[0] || null;
}

function isOutboundBillableStatus(status) {
  return status === "shipped" || status === "delivered";
}

function isInboundBillableStatus(status) {
  return status === "received";
}

function firstValue(row, key) {
  if (!row) return null;
  if (row[key] !== undefined) return row[key];
  const upperKey = key.toUpperCase();
  if (row[upperKey] !== undefined) return row[upperKey];
  return Object.values(row)[0] ?? null;
}

async function hasTable(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  return Number(firstValue(rows[0], "cnt") || 0) > 0;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function resolveBillingRate(conn, clientId, serviceCode, eventDate) {
  const effectiveDate = normalizeDate(eventDate);

  if (await hasTable(conn, "client_contract_rates")) {
    const params = [clientId, serviceCode];
    let dateClause = "";
    if (effectiveDate) {
      dateClause = "AND effective_date <= ?";
      params.push(effectiveDate);
    }
    const [rateRows] = await conn.query(
      `SELECT custom_rate, currency
       FROM client_contract_rates
       WHERE client_id = ?
         AND service_code = ?
         AND deleted_at IS NULL
         ${dateClause}
       ORDER BY effective_date DESC, id DESC
       LIMIT 1`,
      params
    );

    const contractRate = Number(rateRows[0]?.custom_rate || 0);
    const currency = String(rateRows[0]?.currency || "THB").toUpperCase();
    if (contractRate > 0 && ["THB", "KRW"].includes(currency)) {
      return { rate: contractRate, currency };
    }
  }

  if (await hasTable(conn, "service_catalog")) {
    const [serviceRows] = await conn.query(
      `SELECT default_rate, default_currency
       FROM service_catalog
       WHERE service_code = ?
         AND deleted_at IS NULL
         AND status = 'active'
       ORDER BY id DESC
       LIMIT 1`,
      [serviceCode]
    );
    const defaultRate = Number(serviceRows[0]?.default_rate || 0);
    const defaultCurrency = String(serviceRows[0]?.default_currency || "THB").toUpperCase();
    if (defaultRate > 0 && ["THB", "KRW"].includes(defaultCurrency)) {
      return { rate: defaultRate, currency: defaultCurrency };
    }
  }

  return { rate: 0, currency: "THB" };
}

function buildBillingEventAmounts(rateInfo, qty) {
  const unitPrice = Number(rateInfo?.rate || 0);
  const totalQty = Number(qty || 0);
  const currency = String(rateInfo?.currency || "THB").toUpperCase();
  const amount = Number((unitPrice * totalQty).toFixed(4));

  if (currency === "KRW") {
    return {
      pricingPolicy: "KRW_FIXED",
      unitPriceThb: null,
      amountThb: null,
      unitPriceKrw: unitPrice,
      amountKrw: amount
    };
  }

  return {
    pricingPolicy: "THB_BASED",
    unitPriceThb: unitPrice,
    amountThb: amount,
    unitPriceKrw: null,
    amountKrw: null
  };
}

async function syncOutboundOrderBillingEvent(conn, outboundOrderId) {
  const order = await getOutboundOrderForBilling(conn, outboundOrderId);
  if (!order) return null;

  if (!isOutboundBillableStatus(order.status)) {
    await conn.query(
      `UPDATE billing_events
       SET deleted_at = NOW()
       WHERE reference_type = 'OUTBOUND'
         AND reference_id = ?
         AND service_code = 'OUTBOUND_FEE'
         AND deleted_at IS NULL`,
      [String(outboundOrderId)]
    );
    return null;
  }

  const [qtyRows] = await conn.query(
    `SELECT COALESCE(SUM(qty), 0) AS qty
     FROM outbound_items
     WHERE outbound_order_id = ? AND deleted_at IS NULL`,
    [outboundOrderId]
  );
  const totalQty = Number(qtyRows[0]?.qty || 0);

  if (totalQty <= 0) {
    await conn.query(
      `UPDATE billing_events
       SET deleted_at = NOW()
       WHERE reference_type = 'OUTBOUND'
         AND reference_id = ?
         AND service_code = 'OUTBOUND_FEE'
         AND deleted_at IS NULL`,
      [String(outboundOrderId)]
    );
    return null;
  }

  const [existing] = await conn.query(
    `SELECT id
     FROM billing_events
     WHERE reference_type = 'OUTBOUND'
       AND reference_id = ?
       AND service_code = 'OUTBOUND_FEE'
       AND deleted_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [String(outboundOrderId)]
  );

  const eventDate = order.shipped_at || order.order_date;
  const rateInfo = await resolveBillingRate(conn, order.client_id, "OUTBOUND_FEE", eventDate);
  const amounts = buildBillingEventAmounts(rateInfo, totalQty);

  if (existing.length === 0) {
    const [inserted] = await conn.query(
      `INSERT INTO billing_events
        (client_id, warehouse_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw)
       VALUES (?, ?, 'OUTBOUND_FEE', 'OUTBOUND', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.client_id,
        order.warehouse_id,
        String(outboundOrderId),
        eventDate,
        totalQty,
        amounts.pricingPolicy,
        amounts.unitPriceThb,
        amounts.amountThb,
        amounts.unitPriceKrw,
        amounts.amountKrw
      ]
    );
    return inserted.insertId;
  }

  await conn.query(
    `UPDATE billing_events
     SET client_id = ?, warehouse_id = ?, event_date = ?, qty = ?, pricing_policy = ?,
         unit_price_thb = ?, amount_thb = ?, unit_price_krw = ?, amount_krw = ?, deleted_at = NULL
     WHERE id = ?`,
    [
      order.client_id,
      order.warehouse_id,
      eventDate,
      totalQty,
      amounts.pricingPolicy,
      amounts.unitPriceThb,
      amounts.amountThb,
      amounts.unitPriceKrw,
      amounts.amountKrw,
      existing[0].id
    ]
  );

  return existing[0].id;
}

async function syncInboundOrderBillingEvent(conn, inboundOrderId) {
  const order = await getInboundOrderForBilling(conn, inboundOrderId);
  if (!order) return null;

  if (!isInboundBillableStatus(order.status)) {
    await conn.query(
      `UPDATE billing_events
       SET deleted_at = NOW()
       WHERE reference_type = 'INBOUND'
         AND reference_id = ?
         AND service_code = 'INBOUND_FEE'
         AND deleted_at IS NULL`,
      [String(inboundOrderId)]
    );
    return null;
  }

  const [qtyRows] = await conn.query(
    `SELECT COALESCE(SUM(qty), 0) AS qty
     FROM inbound_items
     WHERE inbound_order_id = ? AND deleted_at IS NULL`,
    [inboundOrderId]
  );
  const totalQty = Number(qtyRows[0]?.qty || 0);

  if (totalQty <= 0) {
    await conn.query(
      `UPDATE billing_events
       SET deleted_at = NOW()
       WHERE reference_type = 'INBOUND'
         AND reference_id = ?
         AND service_code = 'INBOUND_FEE'
         AND deleted_at IS NULL`,
      [String(inboundOrderId)]
    );
    return null;
  }

  const [existing] = await conn.query(
    `SELECT id
     FROM billing_events
     WHERE reference_type = 'INBOUND'
       AND reference_id = ?
       AND service_code = 'INBOUND_FEE'
       AND deleted_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [String(inboundOrderId)]
  );

  const eventDate = order.received_at || order.inbound_date;
  const rateInfo = await resolveBillingRate(conn, order.client_id, "INBOUND_FEE", eventDate);
  const amounts = buildBillingEventAmounts(rateInfo, totalQty);

  if (existing.length === 0) {
    const [inserted] = await conn.query(
      `INSERT INTO billing_events
        (client_id, warehouse_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw)
       VALUES (?, ?, 'INBOUND_FEE', 'INBOUND', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.client_id,
        order.warehouse_id,
        String(inboundOrderId),
        eventDate,
        totalQty,
        amounts.pricingPolicy,
        amounts.unitPriceThb,
        amounts.amountThb,
        amounts.unitPriceKrw,
        amounts.amountKrw
      ]
    );
    return inserted.insertId;
  }

  await conn.query(
    `UPDATE billing_events
     SET client_id = ?, warehouse_id = ?, event_date = ?, qty = ?, pricing_policy = ?,
         unit_price_thb = ?, amount_thb = ?, unit_price_krw = ?, amount_krw = ?, deleted_at = NULL
     WHERE id = ?`,
    [
      order.client_id,
      order.warehouse_id,
      eventDate,
      totalQty,
      amounts.pricingPolicy,
      amounts.unitPriceThb,
      amounts.amountThb,
      amounts.unitPriceKrw,
      amounts.amountKrw,
      existing[0].id
    ]
  );

  return existing[0].id;
}

module.exports = {
  syncOutboundOrderBillingEvent,
  syncInboundOrderBillingEvent
};
