#!/usr/bin/env node
require("dotenv").config();

const { startServer } = require("../src/server");
const { ensureFlowTestData } = require("./seed_flow_test_data");

const BASE_URL = process.env.FLOW_TEST_BASE_URL || process.env.API_BASE_URL || "http://localhost:3100";
const INBOUND_QTY = Number(process.env.FLOW_TEST_INBOUND_QTY || 40);
const OUTBOUND_QTY = Number(process.env.FLOW_TEST_OUTBOUND_QTY || 30);

function nowSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isoNow() {
  return new Date().toISOString();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function toQty(value) {
  return Number(value || 0);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(path, { method = "GET", token, body, expectOk = true } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const json = text.trim() ? JSON.parse(text) : {};

  if (expectOk && (!response.ok || !json.ok)) {
    const code = json.code ? ` ${json.code}` : "";
    throw new Error(`${method} ${path} failed (${response.status}${code}): ${json.message || text}`);
  }

  return {
    status: response.status,
    ok: response.ok && json.ok !== false,
    json,
    data: json.data,
  };
}

async function ensureApi() {
  try {
    await requestJson("/health");
    return null;
  } catch {
    const url = new URL(BASE_URL);
    const port = Number(url.port || 3100);
    const server = startServer(port, { startScheduler: false, billingSchemaGuardMode: "warn" });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        await requestJson("/health");
        return server;
      } catch {
        await sleep(500);
      }
    }

    server.close();
    throw new Error(`API did not become ready at ${BASE_URL}`);
  }
}

async function login(email, password) {
  const response = await requestJson("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return response.data.token;
}

function stockQuery(data) {
  const params = new URLSearchParams({
    client_id: String(data.client.id),
    warehouse_id: String(data.warehouse.id),
    product_id: String(data.product.id),
    lot_id: String(data.lot.id),
    location_id: String(data.location.id),
  });
  return `/stock-balances?${params.toString()}`;
}

async function getStock(data, token) {
  const response = await requestJson(stockQuery(data), { token });
  const row = response.data[0];
  assert(row, "Expected one flow-test stock balance row.");
  return {
    available: toQty(row.available_qty),
    reserved: toQty(row.reserved_qty),
  };
}

async function getTransactions(token, query) {
  const params = new URLSearchParams(query);
  const response = await requestJson(`/stock-transactions?${params.toString()}`, { token });
  return response.data;
}

async function createInbound(data, token, suffix) {
  const order = await requestJson("/inbound-orders", {
    method: "POST",
    token,
    body: {
      inbound_no: `FLOW-INB-${suffix}`,
      client_id: data.client.id,
      warehouse_id: data.warehouse.id,
      inbound_date: today(),
      status: "draft",
      memo: "flow inventory e2e",
      created_by: data.loginUserId,
    },
  });

  const item = await requestJson("/inbound-items", {
    method: "POST",
    token,
    body: {
      inbound_order_id: order.data.id,
      product_id: data.product.id,
      lot_id: data.lot.id,
      location_id: data.location.id,
      qty: INBOUND_QTY,
      invoice_price: null,
      currency: null,
      remark: "flow inbound item",
    },
  });

  return { order: order.data, item: item.data };
}

async function putInboundStatus(order, status, token) {
  const response = await requestJson(`/inbound-orders/${order.id}`, {
    method: "PUT",
    token,
    body: {
      inbound_no: order.inbound_no,
      client_id: order.client_id,
      warehouse_id: order.warehouse_id,
      inbound_date: today(),
      status,
      memo: order.memo,
      created_by: order.created_by,
      received_at: status === "received" ? isoNow() : order.received_at,
    },
  });
  return response.data;
}

async function createOutbound(data, token, suffix, qty = OUTBOUND_QTY) {
  const order = await requestJson("/outbound-orders", {
    method: "POST",
    token,
    body: {
      outbound_no: `FLOW-OUT-${suffix}`,
      client_id: data.client.id,
      warehouse_id: data.warehouse.id,
      order_date: today(),
      sales_channel: "manual",
      order_no: `FLOW-ORDER-${suffix}`,
      tracking_no: null,
      status: "draft",
      created_by: data.loginUserId,
    },
  });

  const item = await requestJson("/outbound-items", {
    method: "POST",
    token,
    body: {
      outbound_order_id: order.data.id,
      product_id: data.product.id,
      lot_id: data.lot.id,
      location_id: data.location.id,
      qty,
      box_type: "FLOW",
      box_count: 1,
      remark: "flow outbound item",
    },
  });

  return { order: order.data, item: item.data };
}

async function putOutboundStatus(order, status, token) {
  const response = await requestJson(`/outbound-orders/${order.id}`, {
    method: "PUT",
    token,
    body: {
      outbound_no: order.outbound_no,
      client_id: order.client_id,
      warehouse_id: order.warehouse_id,
      order_date: today(),
      sales_channel: order.sales_channel,
      order_no: order.order_no,
      tracking_no: order.tracking_no,
      status,
      packed_at: status === "packed" || status === "shipped" ? order.packed_at || isoNow() : order.packed_at,
      shipped_at: status === "shipped" ? isoNow() : order.shipped_at,
      created_by: order.created_by,
    },
  });
  return response.data;
}

async function deleteIfPresent(path, token) {
  try {
    await requestJson(path, { method: "DELETE", token });
  } catch (error) {
    console.warn(`[cleanup] ${path}: ${error.message}`);
  }
}

async function main() {
  assert(INBOUND_QTY > 0, "FLOW_TEST_INBOUND_QTY must be positive.");
  assert(OUTBOUND_QTY > 0, "FLOW_TEST_OUTBOUND_QTY must be positive.");
  assert(INBOUND_QTY >= OUTBOUND_QTY, "FLOW_TEST_INBOUND_QTY should be greater than or equal to FLOW_TEST_OUTBOUND_QTY.");

  const seedData = await ensureFlowTestData();
  const server = await ensureApi();
  const token = await login(seedData.login.email, seedData.login.password);
  const loginUser = await requestJson("/auth/me", { token });
  const data = {
    ...seedData,
    loginUserId: loginUser.data.id,
  };

  const suffix = nowSuffix();
  let inboundOrderId = null;
  let outboundOrderId = null;
  let shortageOrderId = null;

  try {
    const before = await getStock(data, token);
    console.log(`BASE_STOCK available=${before.available} reserved=${before.reserved}`);

    const inbound = await createInbound(data, token, suffix);
    inboundOrderId = inbound.order.id;
    const afterInboundDraft = await getStock(data, token);
    assert(afterInboundDraft.available === before.available, "Inbound draft/item create must not increase stock.");
    assert(afterInboundDraft.reserved === before.reserved, "Inbound draft/item create must not reserve stock.");

    let inboundOrder = await putInboundStatus(inbound.order, "submitted", token);
    const afterSubmit = await getStock(data, token);
    assert(afterSubmit.available === before.available, "Inbound submitted must not increase stock.");

    inboundOrder = await putInboundStatus(inboundOrder, "arrived", token);
    const afterArrive = await getStock(data, token);
    assert(afterArrive.available === before.available, "Inbound arrived must not increase stock.");

    inboundOrder = await putInboundStatus(inboundOrder, "received", token);
    assert(inboundOrder.status === "received", "Inbound order should be received.");
    const afterReceive = await getStock(data, token);
    assert(afterReceive.available === before.available + INBOUND_QTY, "Inbound received should increase available stock.");
    assert(afterReceive.reserved === before.reserved, "Inbound received should not change reserved stock.");

    const inboundTxns = await getTransactions(token, {
      ref_type: "inbound_item",
      ref_id: String(inbound.item.id),
      txn_type: "inbound_receive",
    });
    assert(inboundTxns.length >= 1, "Inbound received should create an inbound_receive stock transaction.");
    console.log(`INBOUND_FLOW_OK available=${afterReceive.available} reserved=${afterReceive.reserved}`);

    const outbound = await createOutbound(data, token, suffix);
    outboundOrderId = outbound.order.id;
    const afterOutboundDraft = await getStock(data, token);
    assert(afterOutboundDraft.available === afterReceive.available, "Outbound draft/item create must not deduct stock.");
    assert(afterOutboundDraft.reserved === afterReceive.reserved, "Outbound draft/item create must not reserve stock.");

    let outboundOrder = await putOutboundStatus(outbound.order, "allocated", token);
    assert(outboundOrder.status === "allocated", "Outbound order should be allocated.");
    const afterAllocate = await getStock(data, token);
    assert(afterAllocate.available === afterReceive.available, "Outbound allocated should not deduct available stock.");
    assert(afterAllocate.reserved === afterReceive.reserved + OUTBOUND_QTY, "Outbound allocated should reserve stock.");

    outboundOrder = await putOutboundStatus(outboundOrder, "packed", token);
    assert(outboundOrder.status === "packed", "Outbound order should be packed.");
    const afterPack = await getStock(data, token);
    assert(afterPack.available === afterAllocate.available, "Outbound packed should not deduct available stock.");
    assert(afterPack.reserved === afterAllocate.reserved, "Outbound packed should keep reservation.");

    outboundOrder = await putOutboundStatus(outboundOrder, "shipped", token);
    assert(outboundOrder.status === "shipped", "Outbound order should be shipped.");
    const afterShip = await getStock(data, token);
    assert(afterShip.available === afterPack.available - OUTBOUND_QTY, "Outbound shipped should deduct available stock.");
    assert(afterShip.reserved === afterReceive.reserved, "Outbound shipped should release reservation.");

    const outboundTxns = await getTransactions(token, {
      ref_type: "outbound_item",
      ref_id: String(outbound.item.id),
      txn_type: "outbound_ship",
    });
    assert(outboundTxns.length >= 1, "Outbound shipped should create an outbound_ship stock transaction.");
    console.log(`OUTBOUND_FLOW_OK available=${afterShip.available} reserved=${afterShip.reserved}`);

    const shortageQty = afterShip.available + 1;
    const shortage = await createOutbound(data, token, `${suffix}-SHORT`, shortageQty);
    shortageOrderId = shortage.order.id;
    const shortageResponse = await requestJson(`/outbound-orders/${shortage.order.id}`, {
      method: "PUT",
      token,
      expectOk: false,
      body: {
        outbound_no: shortage.order.outbound_no,
        client_id: shortage.order.client_id,
        warehouse_id: shortage.order.warehouse_id,
        order_date: today(),
        sales_channel: shortage.order.sales_channel,
        order_no: shortage.order.order_no,
        tracking_no: shortage.order.tracking_no,
        status: "allocated",
        packed_at: shortage.order.packed_at,
        shipped_at: shortage.order.shipped_at,
        created_by: shortage.order.created_by,
      },
    });
    assert(shortageResponse.status === 400, "Insufficient stock allocation should return HTTP 400.");
    assert(shortageResponse.json.code === "INSUFFICIENT_STOCK", "Insufficient stock allocation should return INSUFFICIENT_STOCK.");
    console.log(`INSUFFICIENT_STOCK_OK qty=${shortageQty}`);

    console.log("FLOW_E2E_OK");
  } finally {
    if (shortageOrderId) await deleteIfPresent(`/outbound-orders/${shortageOrderId}`, token);
    if (outboundOrderId) await deleteIfPresent(`/outbound-orders/${outboundOrderId}`, token);
    if (inboundOrderId) await deleteIfPresent(`/inbound-orders/${inboundOrderId}`, token);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

main().catch((error) => {
  console.error("[test:e2e:inventory-flow] failed");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
