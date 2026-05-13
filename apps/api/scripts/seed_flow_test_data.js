#!/usr/bin/env node
require("dotenv").config();

const mysql = require("mysql2/promise");

const FLOW_TEST_DEFAULTS = {
  clientCode: process.env.FLOW_TEST_CLIENT_CODE || "FLOW-CLIENT-001",
  warehouseCode: process.env.FLOW_TEST_WAREHOUSE_CODE || "FLOW-WH-001",
  locationCode: process.env.FLOW_TEST_LOCATION_CODE || "FLOW-A-01",
  skuCode: process.env.FLOW_TEST_SKU_CODE || "FLOW-SKU-001",
  barcodeRaw: process.env.FLOW_TEST_BARCODE_RAW || "FLOWBARCODE001",
  barcodeFull: process.env.FLOW_TEST_BARCODE_FULL || "FLOWBARCODE001-TH",
  lotNo: process.env.FLOW_TEST_LOT_NO || "FLOW-LOT-001",
  adminEmail: process.env.FLOW_TEST_ADMIN_EMAIL || "flow.admin@example.com",
  adminPassword: process.env.FLOW_TEST_ADMIN_PASSWORD || "flow1234",
  availableQty: Number(process.env.FLOW_TEST_AVAILABLE_QTY || 100),
};

const REQUIRED_TABLES = [
  "clients",
  "warehouses",
  "warehouse_locations",
  "users",
  "products",
  "product_lots",
  "stock_balances",
  "stock_transactions",
  "inbound_orders",
  "inbound_items",
  "outbound_orders",
  "outbound_items",
  "service_events",
  "billing_events",
];

function mysqlDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function mysqlDateTime(value = new Date()) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wms_test",
  });
}

async function getTablePresence(conn, tableNames) {
  const placeholders = tableNames.map(() => "?").join(", ");
  const [rows] = await conn.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN (${placeholders})`,
    tableNames
  );
  const existing = new Set(
    rows.map((row) => String(row.table_name ?? row.TABLE_NAME ?? Object.values(row)[0] ?? ""))
  );
  return Object.fromEntries(tableNames.map((table) => [table, existing.has(table)]));
}

async function assertRequiredTables(conn) {
  const presence = await getTablePresence(conn, REQUIRED_TABLES);
  const missing = REQUIRED_TABLES.filter((table) => !presence[table]);
  if (missing.length > 0) {
    throw new Error(
      `Flow test schema is missing tables: ${missing.join(", ")}. ` +
        "Apply the API schema patches before running this seed."
    );
  }
}

async function getColumnSet(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  return new Set(rows.map((row) => String(row.column_name ?? row.COLUMN_NAME ?? Object.values(row)[0] ?? "")));
}

function filterColumns(values, columns) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => columns.has(key)));
}

function withAudit(values, columns, creating = false) {
  const now = mysqlDateTime();
  const next = { ...values };
  if (columns.has("deleted_at")) next.deleted_at = null;
  if (columns.has("updated_at")) next.updated_at = now;
  if (creating && columns.has("created_at")) next.created_at = now;
  return next;
}

function whereClause(where) {
  const parts = [];
  const params = [];
  for (const [column, value] of Object.entries(where)) {
    parts.push(`${column} <=> ?`);
    params.push(value);
  }
  return { sql: parts.join(" AND "), params };
}

async function selectOne(conn, tableName, where) {
  const clause = whereClause(where);
  const [rows] = await conn.query(
    `SELECT *
     FROM ${tableName}
     WHERE ${clause.sql}
     LIMIT 1`,
    clause.params
  );
  return rows[0] || null;
}

async function insertRow(conn, tableName, values) {
  const columns = Object.keys(values);
  const placeholders = columns.map(() => "?").join(", ");
  const [result] = await conn.query(
    `INSERT INTO ${tableName} (${columns.join(", ")})
     VALUES (${placeholders})`,
    columns.map((column) => values[column])
  );
  return result.insertId;
}

async function updateRowById(conn, tableName, id, values) {
  const columns = Object.keys(values).filter((column) => column !== "id");
  if (columns.length === 0) return;
  await conn.query(
    `UPDATE ${tableName}
     SET ${columns.map((column) => `${column} = ?`).join(", ")}
     WHERE id = ?`,
    [...columns.map((column) => values[column]), id]
  );
}

async function upsertBy(conn, tableName, where, values) {
  const columns = await getColumnSet(conn, tableName);
  const existing = await selectOne(conn, tableName, where);
  const filtered = filterColumns(withAudit(values, columns, !existing), columns);

  if (existing) {
    await updateRowById(conn, tableName, existing.id, filtered);
    return selectOne(conn, tableName, { id: existing.id });
  }

  const insertId = await insertRow(conn, tableName, filtered);
  return selectOne(conn, tableName, { id: insertId });
}

async function upsertStockBalance(conn, payload) {
  const columns = await getColumnSet(conn, "stock_balances");
  const where = {
    client_id: payload.client_id,
    product_id: payload.product_id,
    lot_id: payload.lot_id,
    warehouse_id: payload.warehouse_id,
    location_id: payload.location_id,
  };
  const existing = await selectOne(conn, "stock_balances", where);
  const values = filterColumns(
    withAudit(
      {
        ...where,
        available_qty: payload.available_qty,
        reserved_qty: 0,
      },
      columns,
      !existing
    ),
    columns
  );

  if (existing) {
    await updateRowById(conn, "stock_balances", existing.id, values);
    return selectOne(conn, "stock_balances", { id: existing.id });
  }

  const insertId = await insertRow(conn, "stock_balances", values);
  return selectOne(conn, "stock_balances", { id: insertId });
}

async function maybeSeedServicePolicy(conn, clientId) {
  const presence = await getTablePresence(conn, ["service_catalog", "price_policies", "service_events"]);
  if (!presence.service_catalog || !presence.price_policies || !presence.service_events) {
    return null;
  }

  const service = await upsertBy(
    conn,
    "service_catalog",
    { service_code: "FLOW_OUTBOUND_QTY" },
    {
      service_code: "FLOW_OUTBOUND_QTY",
      service_name_kr: "Flow outbound fee",
      billing_basis: "QTY",
      default_currency: "KRW",
      status: "active",
    }
  );

  await upsertBy(
    conn,
    "price_policies",
    {
      client_id: clientId,
      service_id: service.id,
      effective_from: mysqlDate(),
    },
    {
      client_id: clientId,
      service_id: service.id,
      unit_price: 100,
      currency: "KRW",
      effective_from: mysqlDate(),
      effective_to: null,
      status: "active",
    }
  );

  return service;
}

async function maybeSeedExchangeRate(conn, userId) {
  const presence = await getTablePresence(conn, ["exchange_rates"]);
  if (!presence.exchange_rates) return null;

  return upsertBy(
    conn,
    "exchange_rates",
    {
      base_currency: "THB",
      quote_currency: "KRW",
      rate_date: mysqlDate(),
    },
    {
      base_currency: "THB",
      quote_currency: "KRW",
      rate: 40,
      rate_date: mysqlDate(),
      status: "active",
      entered_by: userId,
      activated_by: userId,
      activated_at: mysqlDateTime(),
    }
  );
}

async function ensureFlowTestData(input = {}) {
  const config = { ...FLOW_TEST_DEFAULTS, ...input };
  if (!Number.isFinite(config.availableQty) || config.availableQty <= 0) {
    throw new Error("FLOW_TEST_AVAILABLE_QTY must be a positive number.");
  }

  const conn = await createConnection();
  try {
    await assertRequiredTables(conn);
    await conn.beginTransaction();

    const client = await upsertBy(
      conn,
      "clients",
      { client_code: config.clientCode },
      {
        client_code: config.clientCode,
        name_kr: "Flow Test Client",
        name_en: "Flow Test Client",
        contact_name: "Flow Tester",
        phone: "010-0000-0101",
        email: "flow.client@example.com",
        address: "Flow test address",
        status: "active",
      }
    );

    const warehouse = await upsertBy(
      conn,
      "warehouses",
      { code: config.warehouseCode },
      {
        code: config.warehouseCode,
        name: "Flow Test Warehouse",
        country: "KR",
        timezone: "Asia/Seoul",
        default_cbm_size: 0.1,
        default_cbm_rate: 5000,
        status: "active",
      }
    );

    const admin = await upsertBy(
      conn,
      "users",
      { email: config.adminEmail },
      {
        client_id: null,
        email: config.adminEmail,
        password_hash: config.adminPassword,
        name: "Flow Test Admin",
        role: "admin",
        status: "active",
      }
    );

    const product = await upsertBy(
      conn,
      "products",
      {
        client_id: client.id,
        barcode_full: config.barcodeFull,
      },
      {
        client_id: client.id,
        sku_code: config.skuCode,
        barcode_raw: config.barcodeRaw,
        barcode_full: config.barcodeFull,
        name_kr: "Flow Test Product",
        name_en: "Flow Test Product",
        volume_ml: 100,
        unit: "EA",
        width_cm: 5,
        length_cm: 5,
        height_cm: 5,
        cbm_m3: 0.000125,
        min_storage_fee_month: 0,
        status: "active",
      }
    );

    const location = await upsertBy(
      conn,
      "warehouse_locations",
      {
        warehouse_id: warehouse.id,
        location_code: config.locationCode,
      },
      {
        warehouse_id: warehouse.id,
        location_code: config.locationCode,
        zone: "FLOW",
        status: "active",
      }
    );

    const lot = await upsertBy(
      conn,
      "product_lots",
      {
        product_id: product.id,
        lot_no: config.lotNo,
      },
      {
        product_id: product.id,
        lot_no: config.lotNo,
        expiry_date: mysqlDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
        mfg_date: mysqlDate(),
        status: "active",
      }
    );

    const stock = await upsertStockBalance(conn, {
      client_id: client.id,
      product_id: product.id,
      lot_id: lot.id,
      warehouse_id: warehouse.id,
      location_id: location.id,
      available_qty: config.availableQty,
    });

    await maybeSeedServicePolicy(conn, client.id);
    await maybeSeedExchangeRate(conn, admin.id);
    await conn.commit();

    return {
      login: {
        email: config.adminEmail,
        password: config.adminPassword,
      },
      client,
      warehouse,
      location,
      product,
      lot,
      stock,
    };
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    await conn.end();
  }
}

function printSummary(result) {
  console.log("FLOW_TEST_DATA_READY");
  console.log(`login_email=${result.login.email}`);
  console.log(`login_password=${result.login.password}`);
  console.log(`client_id=${result.client.id} client_code=${result.client.client_code}`);
  console.log(`warehouse_id=${result.warehouse.id} warehouse_code=${result.warehouse.code}`);
  console.log(`location_id=${result.location.id} location_code=${result.location.location_code}`);
  console.log(`product_id=${result.product.id} sku_code=${result.product.sku_code}`);
  console.log(`lot_id=${result.lot.id} lot_no=${result.lot.lot_no}`);
  console.log(`available_qty=${result.stock.available_qty} reserved_qty=${result.stock.reserved_qty}`);
  console.log("");
  console.log("Manual flow:");
  console.log("1. Login with the flow test admin account.");
  console.log("2. Create an inbound order using the listed client, warehouse, product, lot, and location.");
  console.log("3. Move inbound status draft -> submitted -> arrived -> received, then check Inventory.");
  console.log("4. Create an outbound order for the same product/lot/location.");
  console.log("5. Move outbound status draft -> allocated -> packed -> shipped, then check Inventory.");
}

if (require.main === module) {
  ensureFlowTestData()
    .then(printSummary)
    .catch((error) => {
      console.error("[seed:flow-test] failed");
      console.error(error && error.message ? error.message : error);
      process.exit(1);
    });
}

module.exports = {
  FLOW_TEST_DEFAULTS,
  ensureFlowTestData,
};
