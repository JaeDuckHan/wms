#!/usr/bin/env node
require("dotenv").config();

const mysql = require("mysql2/promise");

const CONFIG = {
  clientCode: process.env.MENU_TEST_CLIENT_CODE || "MENU-CL-001",
  clientViewerEmail: process.env.MENU_TEST_CLIENT_EMAIL || "menu.client@example.com",
  adminEmail: process.env.MENU_TEST_ADMIN_EMAIL || "menu.admin@example.com",
  managerEmail: process.env.MENU_TEST_MANAGER_EMAIL || "menu.manager@example.com",
  password: process.env.MENU_TEST_PASSWORD || "menu1234",
  warehouseCode: process.env.MENU_TEST_WAREHOUSE_CODE || "MENU-WH-001",
  locations: ["MENU-A-01", "MENU-B-01"],
  fxRate: Number(process.env.MENU_TEST_FX_RATE || 39.25),
};

const REQUIRED_TABLES = [
  "clients",
  "warehouses",
  "warehouse_locations",
  "users",
  "products",
  "product_lots",
  "inbound_orders",
  "inbound_items",
  "outbound_orders",
  "outbound_items",
  "return_orders",
  "return_items",
  "stock_balances",
  "stock_transactions",
  "service_catalog",
  "price_policies",
  "exchange_rates",
  "billing_events",
  "invoices",
  "invoice_items",
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function ymd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function ymdhm(date, hour, minute, second = 0) {
  return `${ymd(date)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayInCurrentMonth(today, preferredDay) {
  return new Date(today.getFullYear(), today.getMonth(), Math.min(preferredDay, today.getDate()));
}

function previousMonthDate(today, preferredDay) {
  const date = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(preferredDay, lastDay));
  return date;
}

function monthOf(date) {
  return ymd(date).slice(0, 7);
}

function connect() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wms_test",
    multipleStatements: false,
  });
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function columnSet(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  return new Set(rows.map((row) => String(row.column_name ?? row.COLUMN_NAME ?? Object.values(row)[0] ?? "")));
}

async function columnIsNullable(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0 && String(rows[0].is_nullable ?? rows[0].IS_NULLABLE ?? Object.values(rows[0])[0] ?? "").toUpperCase() === "YES";
}

async function assertTables(conn) {
  const missing = [];
  for (const tableName of REQUIRED_TABLES) {
    if (!(await tableExists(conn, tableName))) missing.push(tableName);
  }
  if (missing.length > 0) {
    throw new Error(`Missing required tables: ${missing.join(", ")}. Apply schema patches first.`);
  }
}

async function selectOne(conn, tableName, where) {
  const keys = Object.keys(where);
  const [rows] = await conn.query(
    `SELECT *
     FROM ${tableName}
     WHERE ${keys.map((key) => `${key} <=> ?`).join(" AND ")}
     LIMIT 1`,
    keys.map((key) => where[key])
  );
  return rows[0] || null;
}

function withAudit(values, columns, creating) {
  const now = ymdhm(new Date(), new Date().getHours(), new Date().getMinutes(), new Date().getSeconds());
  const next = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && columns.has(key)) next[key] = value;
  }
  if (columns.has("deleted_at")) next.deleted_at = null;
  if (columns.has("updated_at")) next.updated_at = now;
  if (creating && columns.has("created_at")) next.created_at = now;
  return next;
}

async function insertRow(conn, tableName, values) {
  const keys = Object.keys(values);
  const [result] = await conn.query(
    `INSERT INTO ${tableName} (${keys.join(", ")})
     VALUES (${keys.map(() => "?").join(", ")})`,
    keys.map((key) => values[key])
  );
  return Number(result.insertId);
}

async function updateById(conn, tableName, id, values) {
  const keys = Object.keys(values).filter((key) => key !== "id");
  if (keys.length === 0) return;
  await conn.query(
    `UPDATE ${tableName}
     SET ${keys.map((key) => `${key} = ?`).join(", ")}
     WHERE id = ?`,
    [...keys.map((key) => values[key]), id]
  );
}

async function upsertBy(conn, tableName, where, values) {
  const columns = await columnSet(conn, tableName);
  const existing = await selectOne(conn, tableName, where);
  const filtered = withAudit({ ...where, ...values }, columns, !existing);

  if (existing) {
    await updateById(conn, tableName, existing.id, filtered);
    return selectOne(conn, tableName, { id: existing.id });
  }

  const id = await insertRow(conn, tableName, filtered);
  return selectOne(conn, tableName, { id });
}

async function upsertSingleItem(conn, tableName, orderColumn, orderId, values) {
  const [rows] = await conn.query(
    `SELECT id
     FROM ${tableName}
     WHERE ${orderColumn} = ?
       AND remark = ?
       AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT 1`,
    [orderId, values.remark]
  );

  const columns = await columnSet(conn, tableName);
  const filtered = withAudit({ [orderColumn]: orderId, ...values }, columns, rows.length === 0);
  if (rows.length > 0) {
    await updateById(conn, tableName, rows[0].id, filtered);
    return selectOne(conn, tableName, { id: rows[0].id });
  }
  const id = await insertRow(conn, tableName, filtered);
  return selectOne(conn, tableName, { id });
}

async function upsertReturnItem(conn, returnOrderId, values) {
  const [rows] = await conn.query(
    `SELECT id
     FROM return_items
     WHERE return_order_id = ?
       AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT 1`,
    [returnOrderId]
  );
  const columns = await columnSet(conn, "return_items");
  const filtered = withAudit({ return_order_id: returnOrderId, ...values }, columns, rows.length === 0);
  if (rows.length > 0) {
    await updateById(conn, "return_items", rows[0].id, filtered);
    return selectOne(conn, "return_items", { id: rows[0].id });
  }
  const id = await insertRow(conn, "return_items", filtered);
  return selectOne(conn, "return_items", { id });
}

async function upsertStockTxn(conn, values) {
  const columns = await columnSet(conn, "stock_transactions");
  const existing = await selectOne(conn, "stock_transactions", {
    txn_type: values.txn_type,
    ref_type: values.ref_type,
    ref_id: values.ref_id,
  });
  const filtered = withAudit(values, columns, !existing);

  if (existing) {
    await updateById(conn, "stock_transactions", existing.id, filtered);
    return selectOne(conn, "stock_transactions", { id: existing.id });
  }
  const id = await insertRow(conn, "stock_transactions", filtered);
  return selectOne(conn, "stock_transactions", { id });
}

async function softDeleteStockTxn(conn, txnType, refType, refId) {
  await conn.query(
    `UPDATE stock_transactions
     SET deleted_at = NOW()
     WHERE txn_type = ?
       AND ref_type = ?
       AND ref_id = ?
       AND deleted_at IS NULL`,
    [txnType, refType, refId]
  );
}

async function upsertStockBalance(conn, values) {
  const where = {
    client_id: values.client_id,
    product_id: values.product_id,
    lot_id: values.lot_id,
    warehouse_id: values.warehouse_id,
    location_id: values.location_id,
  };
  return upsertBy(conn, "stock_balances", where, {
    available_qty: values.available_qty,
    reserved_qty: values.reserved_qty,
  });
}

async function upsertBillingEvent(conn, values) {
  const [rows] = await conn.query(
    `SELECT id
     FROM billing_events
     WHERE service_code = ?
       AND reference_type = ?
       AND reference_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [values.service_code, values.reference_type, values.reference_id]
  );

  const columns = await columnSet(conn, "billing_events");
  const filtered = withAudit(values, columns, rows.length === 0);
  let id;

  if (rows.length > 0) {
    id = Number(rows[0].id);
    await updateById(conn, "billing_events", id, filtered);
  } else {
    id = await insertRow(conn, "billing_events", filtered);
  }

  await conn.query(
    `UPDATE billing_events
     SET deleted_at = NOW()
     WHERE service_code = ?
       AND reference_type = ?
       AND reference_id = ?
       AND id <> ?
       AND deleted_at IS NULL`,
    [values.service_code, values.reference_type, values.reference_id, id]
  );
  return selectOne(conn, "billing_events", { id });
}

async function ensureClientAndUsers(conn) {
  const client = await upsertBy(
    conn,
    "clients",
    { client_code: CONFIG.clientCode },
    {
      name_kr: "Menu Test Client",
      name_en: "Menu Test Client",
      contact_name: "Menu Tester",
      phone: "010-0000-0201",
      email: "menu.client@example.com",
      address: "Menu test address",
      status: "active",
    }
  );

  const admin = await upsertBy(
    conn,
    "users",
    { email: CONFIG.adminEmail },
    {
      client_id: null,
      password_hash: CONFIG.password,
      name: "Menu Test Admin",
      role: "admin",
      status: "active",
    }
  );

  await upsertBy(
    conn,
    "users",
    { email: CONFIG.managerEmail },
    {
      client_id: null,
      password_hash: CONFIG.password,
      name: "Menu Test Manager",
      role: "manager",
      status: "active",
    }
  );

  await upsertBy(
    conn,
    "users",
    { email: CONFIG.clientViewerEmail },
    {
      client_id: client.id,
      password_hash: CONFIG.password,
      name: "Menu Test Client Viewer",
      role: "client_viewer",
      status: "active",
    }
  );

  return { client, admin };
}

async function ensureWarehouse(conn, clientId) {
  const warehouse = await upsertBy(
    conn,
    "warehouses",
    { code: CONFIG.warehouseCode },
    {
      name: "Menu Test Warehouse",
      country: "KR",
      timezone: "Asia/Seoul",
      capacity_cbm: 1500,
      capacity_pallet: 900,
      status: "active",
    }
  );

  const locations = [];
  for (const [index, locationCode] of CONFIG.locations.entries()) {
    const location = await upsertBy(
      conn,
      "warehouse_locations",
      { warehouse_id: warehouse.id, location_code: locationCode },
      {
        zone: index === 0 ? "FLOW" : "RESERVE",
        status: "active",
      }
    );
    locations.push(location);
  }

  const clientColumns = await columnSet(conn, "clients");
  if (clientColumns.has("default_warehouse_id")) {
    await updateById(conn, "clients", clientId, { default_warehouse_id: warehouse.id });
  }

  return { warehouse, locations };
}

async function ensureProducts(conn, client, today) {
  const specs = [
    {
      sku_code: "MENU-SKU-001",
      barcode_raw: "MENUTEST001",
      name_kr: "Menu Test Product A",
      name_en: "Menu Test Product A",
      width_cm: 5,
      length_cm: 6,
      height_cm: 8,
      cbm_m3: 0.00024,
      min_storage_fee_month: 2500,
    },
    {
      sku_code: "MENU-SKU-002",
      barcode_raw: "MENUTEST002",
      name_kr: "Menu Test Product B Low Stock",
      name_en: "Menu Test Product B Low Stock",
      width_cm: 8,
      length_cm: 10,
      height_cm: 12,
      cbm_m3: 0.00096,
      min_storage_fee_month: 4000,
    },
    {
      sku_code: "MENU-SKU-MANUAL",
      barcode_raw: "MENUMANUAL001",
      name_kr: "Menu Manual Product Template",
      name_en: "Menu Manual Product Template",
      width_cm: 10,
      length_cm: 10,
      height_cm: 10,
      cbm_m3: 0.001,
      min_storage_fee_month: 0,
    },
  ];

  const products = [];
  const lots = [];
  for (const spec of specs) {
    const product = await upsertBy(
      conn,
      "products",
      { client_id: client.id, barcode_raw: spec.barcode_raw },
      {
        sku_code: spec.sku_code,
        barcode_full: `${client.client_code}-${spec.barcode_raw}`,
        name_kr: spec.name_kr,
        name_en: spec.name_en,
        volume_ml: null,
        width_cm: spec.width_cm,
        length_cm: spec.length_cm,
        height_cm: spec.height_cm,
        cbm_m3: spec.cbm_m3,
        min_storage_fee_month: spec.min_storage_fee_month,
        unit: "EA",
        status: "active",
      }
    );
    const lot = await upsertBy(
      conn,
      "product_lots",
      { product_id: product.id, lot_no: `${spec.sku_code}-LOT-${ymd(today).replaceAll("-", "")}` },
      {
        expiry_date: ymd(addDays(today, 365)),
        mfg_date: ymd(addDays(today, -30)),
        status: "active",
      }
    );
    products.push(product);
    lots.push(lot);
  }

  return { products, lots };
}

async function ensureBillingSettings(conn, clientId, adminId, today) {
  const serviceColumns = await columnSet(conn, "service_catalog");
  const services = [
    ["INBOUND_FEE", "Inbound Handling Fee", "QTY", "SKU", "KRW_FIXED", "KRW", 800],
    ["OUTBOUND_FEE", "Outbound Handling Fee", "QTY", "SKU", "KRW_FIXED", "KRW", 1200],
    ["TH_SHIPPING", "Thailand Shipping Fee", "ORDER", "ORDER", "THB_BASED", "THB", 120],
    ["TH_BOX", "Thailand Box Fee", "BOX", "BOX", "THB_BASED", "THB", 8],
    ["STORAGE_MIN_FEE", "Storage Minimum Fee", "MANUAL", "MONTH", "KRW_FIXED", "KRW", 2500],
  ];

  for (const [code, name, basis, unit, pricing, currency, rate] of services) {
    await upsertBy(
      conn,
      "service_catalog",
      { service_code: code },
      {
        service_name_kr: name,
        service_name: serviceColumns.has("service_name") ? name : undefined,
        billing_basis: basis,
        billing_unit: serviceColumns.has("billing_unit") ? unit : undefined,
        pricing_policy: serviceColumns.has("pricing_policy") ? pricing : undefined,
        default_currency: currency,
        default_rate: serviceColumns.has("default_rate") ? rate : undefined,
        status: "active",
      }
    );
  }

  const [serviceRows] = await conn.query(
    `SELECT id, service_code, default_currency
     FROM service_catalog
     WHERE service_code IN ('INBOUND_FEE', 'OUTBOUND_FEE', 'TH_SHIPPING', 'TH_BOX', 'STORAGE_MIN_FEE')
       AND deleted_at IS NULL`
  );
  const rateByCode = new Map(services.map(([code, _name, _basis, _unit, _pricing, _currency, rate]) => [code, rate]));

  for (const service of serviceRows) {
    await upsertBy(
      conn,
      "price_policies",
      {
        client_id: clientId,
        service_id: service.id,
        effective_from: ymd(today),
      },
      {
        unit_price: rateByCode.get(service.service_code) || 0,
        currency: service.default_currency,
        effective_to: null,
        status: "active",
      }
    );
  }

  if (await tableExists(conn, "client_contract_rates")) {
    for (const [serviceCode, _name, _basis, _unit, _pricing, currency, rate] of services) {
      await upsertBy(
        conn,
        "client_contract_rates",
        {
          client_id: clientId,
          service_code: serviceCode,
          effective_date: ymd(today),
        },
        {
          custom_rate: rate,
          currency,
        }
      );
    }
  }

  await upsertBy(
    conn,
    "exchange_rates",
    {
      base_currency: "THB",
      quote_currency: "KRW",
      rate_date: ymd(today),
    },
    {
      rate: CONFIG.fxRate,
      source: "manual",
      locked: 0,
      status: "active",
      entered_by: adminId,
      activated_by: adminId,
      activated_at: ymdhm(today, 9, 0),
    }
  );
}

async function ensureInboundOrders(conn, ctx) {
  const { client, warehouse, locations, products, lots, admin, dates } = ctx;
  const specs = [
    {
      suffix: "DRAFT",
      status: "draft",
      date: dates.today,
      product: products[0],
      lot: lots[0],
      location: locations[0],
      qty: 24,
      invoice_price: 3.4,
      currency: "USD",
      stock: false,
    },
    {
      suffix: "ARRIVED",
      status: "arrived",
      date: dates.yesterday,
      product: products[1],
      lot: lots[1],
      location: locations[1],
      qty: 18,
      invoice_price: 45,
      currency: "THB",
      stock: false,
    },
    {
      suffix: "RECEIVED",
      status: "received",
      date: dates.start,
      product: products[0],
      lot: lots[0],
      location: locations[0],
      qty: 160,
      invoice_price: 42,
      currency: "THB",
      stock: true,
    },
    {
      suffix: "RECEIVED-B",
      status: "received",
      date: dates.mid,
      product: products[1],
      lot: lots[1],
      location: locations[1],
      qty: 20,
      invoice_price: 52,
      currency: "THB",
      stock: true,
    },
  ];

  const orders = [];
  for (const spec of specs) {
    const inboundNo = `MENU-INB-${ymd(spec.date).replaceAll("-", "")}-${spec.suffix}`;
    const order = await upsertBy(
      conn,
      "inbound_orders",
      { inbound_no: inboundNo },
      {
        client_id: client.id,
        warehouse_id: warehouse.id,
        inbound_date: ymd(spec.date),
        status: spec.status,
        memo: `MENU_TEST ${spec.suffix}`,
        created_by: admin.id,
        received_at: spec.stock ? ymdhm(spec.date, 10, 30) : null,
      }
    );
    const item = await upsertSingleItem(conn, "inbound_items", "inbound_order_id", order.id, {
      product_id: spec.product.id,
      lot_id: spec.lot.id,
      location_id: spec.location.id,
      qty: spec.qty,
      invoice_price: spec.invoice_price,
      currency: spec.currency,
      remark: `MENU_TEST ${spec.suffix}`,
    });

    if (spec.stock) {
      await upsertStockTxn(conn, {
        client_id: client.id,
        product_id: spec.product.id,
        lot_id: spec.lot.id,
        warehouse_id: warehouse.id,
        location_id: spec.location.id,
        txn_type: "inbound_receive",
        txn_date: ymdhm(spec.date, 10, 35),
        qty_in: spec.qty,
        qty_out: 0,
        ref_type: "inbound_item",
        ref_id: item.id,
        note: `MENU_TEST inbound ${spec.suffix}`,
        created_by: admin.id,
      });
      await upsertBillingEvent(conn, {
        client_id: client.id,
        warehouse_id: warehouse.id,
        service_code: "INBOUND_FEE",
        reference_type: "INBOUND",
        reference_id: String(order.id),
        event_date: ymd(spec.date),
        qty: spec.qty,
        pricing_policy: "KRW_FIXED",
        unit_price_krw: 800,
        amount_krw: spec.qty * 800,
        unit_price_thb: null,
        amount_thb: null,
        fx_rate_thbkrw: null,
        invoice_id: null,
        status: "PENDING",
      });
    } else {
      await softDeleteStockTxn(conn, "inbound_receive", "inbound_item", item.id);
      await conn.query(
        `UPDATE billing_events
         SET deleted_at = NOW()
         WHERE reference_type = 'INBOUND'
           AND reference_id = ?
           AND deleted_at IS NULL`,
        [String(order.id)]
      );
    }
    orders.push({ order, item, spec });
  }
  return orders;
}

async function ensureOutboundOrders(conn, ctx) {
  const { client, warehouse, locations, products, lots, admin, dates } = ctx;
  const specs = [
    {
      suffix: "DRAFT",
      status: "draft",
      date: dates.today,
      qty: 12,
      box_count: 0,
      stock: false,
      bill: false,
    },
    {
      suffix: "ALLOCATED",
      status: "allocated",
      date: dates.today,
      qty: 20,
      box_count: 2,
      stock: false,
      bill: false,
    },
    {
      suffix: "PACKED",
      status: "packed",
      date: dates.yesterday,
      qty: 15,
      box_count: 2,
      stock: false,
      bill: false,
    },
    {
      suffix: "SHIPPED",
      status: "shipped",
      date: dates.mid,
      qty: 35,
      box_count: 4,
      stock: true,
      bill: true,
    },
  ];

  const orders = [];
  for (const spec of specs) {
    const outboundNo = `MENU-OUT-${ymd(spec.date).replaceAll("-", "")}-${spec.suffix}`;
    const order = await upsertBy(
      conn,
      "outbound_orders",
      { outbound_no: outboundNo },
      {
        client_id: client.id,
        warehouse_id: warehouse.id,
        order_date: ymd(spec.date),
        sales_channel: spec.suffix === "SHIPPED" ? "Coupang" : "Naver SmartStore",
        order_no: `MENU-ORD-${ymd(spec.date).replaceAll("-", "")}-${spec.suffix}`,
        tracking_no: spec.status === "shipped" ? `MENU-TRK-${ymd(spec.date).replaceAll("-", "")}` : null,
        status: spec.status,
        packed_at: ["packed", "shipped", "delivered"].includes(spec.status) ? ymdhm(spec.date, 13, 20) : null,
        shipped_at: spec.status === "shipped" ? ymdhm(spec.date, 15, 10) : null,
        created_by: admin.id,
      }
    );
    const item = await upsertSingleItem(conn, "outbound_items", "outbound_order_id", order.id, {
      product_id: products[0].id,
      lot_id: lots[0].id,
      location_id: locations[0].id,
      qty: spec.qty,
      box_type: "MENU_BOX",
      box_count: spec.box_count,
      remark: `MENU_TEST ${spec.suffix}`,
    });

    if (spec.stock) {
      await upsertStockTxn(conn, {
        client_id: client.id,
        product_id: products[0].id,
        lot_id: lots[0].id,
        warehouse_id: warehouse.id,
        location_id: locations[0].id,
        from_location_id: locations[0].id,
        to_location_id: null,
        txn_type: "outbound_ship",
        txn_date: ymdhm(spec.date, 15, 15),
        qty_in: 0,
        qty_out: spec.qty,
        ref_type: "outbound_item",
        ref_id: item.id,
        note: `MENU_TEST outbound ${spec.suffix}`,
        created_by: admin.id,
      });
      await upsertBillingEvent(conn, {
        client_id: client.id,
        warehouse_id: warehouse.id,
        service_code: "OUTBOUND_FEE",
        reference_type: "OUTBOUND",
        reference_id: String(order.id),
        event_date: ymd(spec.date),
        qty: spec.qty,
        pricing_policy: "KRW_FIXED",
        unit_price_krw: 1200,
        amount_krw: spec.qty * 1200,
        unit_price_thb: null,
        amount_thb: null,
        fx_rate_thbkrw: null,
        invoice_id: null,
        status: "PENDING",
      });
      await upsertBillingEvent(conn, {
        client_id: client.id,
        warehouse_id: warehouse.id,
        service_code: "TH_SHIPPING",
        reference_type: "SHIPPING",
        reference_id: `MENU-SHIP-${order.id}`,
        event_date: ymd(spec.date),
        qty: 1,
        pricing_policy: "THB_BASED",
        unit_price_thb: 120,
        amount_thb: 120,
        unit_price_krw: null,
        amount_krw: null,
        fx_rate_thbkrw: null,
        invoice_id: null,
        status: "PENDING",
      });
      await upsertBillingEvent(conn, {
        client_id: client.id,
        warehouse_id: warehouse.id,
        service_code: "TH_BOX",
        reference_type: "SHIPPING",
        reference_id: `MENU-BOX-${order.id}`,
        event_date: ymd(spec.date),
        qty: spec.box_count,
        pricing_policy: "THB_BASED",
        unit_price_thb: 8,
        amount_thb: spec.box_count * 8,
        unit_price_krw: null,
        amount_krw: null,
        fx_rate_thbkrw: null,
        invoice_id: null,
        status: "PENDING",
      });
    } else {
      await softDeleteStockTxn(conn, "outbound_ship", "outbound_item", item.id);
    }
    orders.push({ order, item, spec });
  }
  return orders;
}

async function ensureReturns(conn, ctx) {
  const { client, warehouse, locations, products, lots, admin, dates } = ctx;
  const returnOrder = await upsertBy(
    conn,
    "return_orders",
    { return_no: `MENU-RET-${ymd(dates.today).replaceAll("-", "")}-RESTOCK` },
    {
      client_id: client.id,
      warehouse_id: warehouse.id,
      related_outbound_order_id: null,
      return_date: ymd(dates.today),
      status: "restocked",
      reason: "MENU_TEST return restock",
      created_by: admin.id,
    }
  );

  const item = await upsertReturnItem(conn, returnOrder.id, {
    product_id: products[0].id,
    lot_id: lots[0].id,
    location_id: locations[0].id,
    qty_received: 8,
    qty_restocked: 6,
    qty_disposed: 2,
    disposition_reason: "MENU_TEST return split",
  });

  await upsertStockTxn(conn, {
    client_id: client.id,
    product_id: products[0].id,
    lot_id: lots[0].id,
    warehouse_id: warehouse.id,
    location_id: locations[0].id,
    txn_type: "return_restock",
    txn_date: ymdhm(dates.today, 16, 10),
    qty_in: 6,
    qty_out: 0,
    ref_type: "return_item",
    ref_id: item.id,
    note: "MENU_TEST return restock",
    created_by: admin.id,
  });

  await upsertStockTxn(conn, {
    client_id: client.id,
    product_id: products[0].id,
    lot_id: lots[0].id,
    warehouse_id: warehouse.id,
    location_id: locations[0].id,
    txn_type: "return_dispose",
    txn_date: ymdhm(dates.today, 16, 20),
    qty_in: 0,
    qty_out: 2,
    ref_type: "return_item",
    ref_id: item.id,
    note: "MENU_TEST return dispose",
    created_by: admin.id,
  });
}

async function resetCurrentMenuInvoices(conn, clientId, currentMonth) {
  const invoiceColumns = await columnSet(conn, "invoices");
  if (!invoiceColumns.has("invoice_month")) return;

  const [rows] = await conn.query(
    `SELECT id
     FROM invoices
     WHERE client_id = ?
       AND invoice_month = ?
       AND deleted_at IS NULL`,
    [clientId, currentMonth]
  );
  const ids = rows.map((row) => Number(row.id));
  if (ids.length === 0) return;

  await conn.query(
    `UPDATE billing_events
     SET status = 'PENDING', invoice_id = NULL, fx_rate_thbkrw = NULL
     WHERE invoice_id IN (${ids.map(() => "?").join(", ")})
       AND deleted_at IS NULL`,
    ids
  );
  await conn.query(
    `UPDATE invoice_items
     SET deleted_at = NOW()
     WHERE invoice_id IN (${ids.map(() => "?").join(", ")})
       AND deleted_at IS NULL`,
    ids
  );
  await conn.query(
    `UPDATE invoices
     SET deleted_at = NOW()
     WHERE id IN (${ids.map(() => "?").join(", ")})`,
    ids
  );
}

async function ensureHistoricalInvoice(conn, ctx) {
  const { client, admin, dates } = ctx;
  const nullableSettlement = await columnIsNullable(conn, "invoices", "settlement_batch_id");
  const invoiceColumns = await columnSet(conn, "invoices");
  if (!nullableSettlement || !invoiceColumns.has("invoice_month")) {
    return null;
  }

  const invoiceMonth = monthOf(dates.previousMonth);
  const invoiceNo = `MENU-HIST-${client.id}-${invoiceMonth.replace("-", "")}-0001`;
  const subtotal = 120000;
  const vat = 8400;
  const total = 128400;

  const existing = await selectOne(conn, "invoices", { invoice_no: invoiceNo });
  const values = withAudit(
    {
      settlement_batch_id: null,
      client_id: client.id,
      invoice_month: invoiceMonth,
      invoice_no: invoiceNo,
      status: "issued",
      issue_date: ymd(dates.previousMonth),
      invoice_date: ymd(dates.previousMonth),
      due_date: ymd(addDays(dates.previousMonth, 7)),
      recipient_email: "billing-menu@example.com",
      currency: "KRW",
      fx_rate_thbkrw: CONFIG.fxRate,
      subtotal_krw: subtotal,
      vat_krw: vat,
      total_krw: total,
      total_amount: total,
      created_by: admin.id,
    },
    invoiceColumns,
    !existing
  );

  let invoiceId;
  if (existing) {
    invoiceId = Number(existing.id);
    await updateById(conn, "invoices", invoiceId, values);
  } else {
    invoiceId = await insertRow(conn, "invoices", values);
  }

  await conn.query("UPDATE invoice_items SET deleted_at = NOW() WHERE invoice_id = ? AND deleted_at IS NULL", [invoiceId]);
  await insertRow(conn, "invoice_items", {
    invoice_id: invoiceId,
    service_code: "OUTBOUND_FEE",
    description: "Historical menu outbound handling",
    qty: 100,
    unit_price_krw: 1200,
    amount_krw: 120000,
  });
  await insertRow(conn, "invoice_items", {
    invoice_id: invoiceId,
    service_code: "VAT_7",
    description: "VAT 7%",
    qty: 1,
    unit_price_krw: 8400,
    amount_krw: 8400,
  });

  return invoiceId;
}

async function ensureStorageSnapshots(conn, ctx) {
  const { client, warehouse, dates } = ctx;
  if (!(await tableExists(conn, "storage_snapshots"))) return;

  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(dates.today, -i);
    await upsertBy(
      conn,
      "storage_snapshots",
      {
        warehouse_id: warehouse.id,
        client_id: client.id,
        snapshot_date: ymd(date),
      },
      {
        total_cbm: Number((22 + (6 - i) * 1.7).toFixed(4)),
        total_pallet: 12 + (6 - i),
        total_sku: 2 + ((6 - i) % 2),
      }
    );
  }
}

async function ensureFinalStock(conn, ctx) {
  const { client, warehouse, locations, products, lots } = ctx;
  await upsertStockBalance(conn, {
    client_id: client.id,
    product_id: products[0].id,
    lot_id: lots[0].id,
    warehouse_id: warehouse.id,
    location_id: locations[0].id,
    available_qty: 129,
    reserved_qty: 35,
  });
  await upsertStockBalance(conn, {
    client_id: client.id,
    product_id: products[1].id,
    lot_id: lots[1].id,
    warehouse_id: warehouse.id,
    location_id: locations[1].id,
    available_qty: 20,
    reserved_qty: 0,
  });
  await upsertStockBalance(conn, {
    client_id: client.id,
    product_id: products[2].id,
    lot_id: lots[2].id,
    warehouse_id: warehouse.id,
    location_id: locations[0].id,
    available_qty: 0,
    reserved_qty: 0,
  });
}

async function collectSummary(conn, clientId, currentMonth) {
  const [[inboundCounts], [outboundCounts], [stockRows], [billingRows], [snapshotRows]] = await Promise.all([
    conn.query(
      `SELECT status, COUNT(*) AS count
       FROM inbound_orders
       WHERE inbound_no LIKE 'MENU-INB-%'
         AND deleted_at IS NULL
       GROUP BY status
       ORDER BY status`
    ),
    conn.query(
      `SELECT status, COUNT(*) AS count
       FROM outbound_orders
       WHERE outbound_no LIKE 'MENU-OUT-%'
         AND deleted_at IS NULL
       GROUP BY status
       ORDER BY status`
    ),
    conn.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(available_qty), 0) AS available_qty, COALESCE(SUM(reserved_qty), 0) AS reserved_qty
       FROM stock_balances
       WHERE client_id = ?
         AND deleted_at IS NULL`,
      [clientId]
    ),
    conn.query(
      `SELECT status, COUNT(*) AS count
       FROM billing_events
       WHERE client_id = ?
         AND DATE_FORMAT(event_date, '%Y-%m') = ?
         AND deleted_at IS NULL
       GROUP BY status
       ORDER BY status`,
      [clientId, currentMonth]
    ),
    conn.query(
      `SELECT COUNT(*) AS count
       FROM storage_snapshots
       WHERE client_id = ?`,
      [clientId]
    ),
  ]);

  return {
    inboundCounts,
    outboundCounts,
    stock: stockRows[0],
    billingCounts: billingRows,
    storageSnapshots: snapshotRows[0],
  };
}

async function main() {
  let conn = null;
  const today = new Date();
  const dates = {
    today,
    yesterday: addDays(today, -1),
    start: dayInCurrentMonth(today, 1),
    mid: dayInCurrentMonth(today, 10),
    previousMonth: previousMonthDate(today, 20),
  };
  const currentMonth = monthOf(today);

  try {
    conn = await connect();
    await assertTables(conn);
    await conn.beginTransaction();

    const { client, admin } = await ensureClientAndUsers(conn);
    const { warehouse, locations } = await ensureWarehouse(conn, client.id);
    const { products, lots } = await ensureProducts(conn, client, today);

    const ctx = { client, admin, warehouse, locations, products, lots, dates };
    await ensureBillingSettings(conn, client.id, admin.id, today);
    await resetCurrentMenuInvoices(conn, client.id, currentMonth);
    await ensureInboundOrders(conn, ctx);
    await ensureOutboundOrders(conn, ctx);
    await ensureReturns(conn, ctx);
    await ensureFinalStock(conn, ctx);
    await upsertBillingEvent(conn, {
      client_id: client.id,
      warehouse_id: warehouse.id,
      service_code: "STORAGE_MIN_FEE",
      reference_type: "STORAGE",
      reference_id: `MENU-STORAGE-${client.id}-${currentMonth}`,
      event_date: ymd(today),
      qty: 1,
      pricing_policy: "KRW_FIXED",
      unit_price_krw: 2500,
      amount_krw: 2500,
      unit_price_thb: null,
      amount_thb: null,
      fx_rate_thbkrw: null,
      invoice_id: null,
      status: "PENDING",
    });
    const historicalInvoiceId = await ensureHistoricalInvoice(conn, ctx);
    await ensureStorageSnapshots(conn, ctx);

    await conn.commit();

    const summary = await collectSummary(conn, client.id, currentMonth);
    console.log("MENU_TEST_DATA_READY");
    console.log(`date=${ymd(today)} invoice_month=${currentMonth}`);
    console.log(`admin=${CONFIG.adminEmail} password=${CONFIG.password}`);
    console.log(`manager=${CONFIG.managerEmail} password=${CONFIG.password}`);
    console.log(`client_viewer=${CONFIG.clientViewerEmail} password=${CONFIG.password}`);
    console.log(`client_id=${client.id} client_code=${client.client_code}`);
    console.log(`warehouse_id=${warehouse.id} warehouse_code=${warehouse.code}`);
    console.log(`locations=${locations.map((location) => `${location.id}:${location.location_code}`).join(",")}`);
    console.log(`products=${products.map((product) => `${product.id}:${product.barcode_full}`).join(",")}`);
    console.log(`historical_invoice_id=${historicalInvoiceId || "skipped"}`);
    console.log("inbound_counts=", JSON.stringify(summary.inboundCounts));
    console.log("outbound_counts=", JSON.stringify(summary.outboundCounts));
    console.log("stock=", JSON.stringify(summary.stock));
    console.log("billing_counts=", JSON.stringify(summary.billingCounts));
    console.log("storage_snapshots=", JSON.stringify(summary.storageSnapshots));
    console.log("");
    console.log("Manual test path:");
    console.log("1. Login as menu.admin@example.com / menu1234.");
    console.log("2. Settings > Products: add a product using client MENU-CL-001, then verify it appears in product and inbound/outbound product selectors.");
    console.log("3. Inbounds: use MENU-INB-* DRAFT or create a new inbound, then Submit -> Arrive -> Receive.");
    console.log("4. Inventory: verify balances and transaction filters for inbound_receive, outbound_ship, return_restock, return_dispose.");
    console.log("5. Outbounds: use MENU-OUT-* DRAFT or create a new outbound, then Allocate -> Pack -> Ship.");
    console.log("6. Billing Events: filter invoice_month above and client MENU-CL-001, then generate invoice from Invoices.");
    console.log("7. Invoices: issue and mark-paid the generated invoice; historical issued invoice is available when supported.");
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore rollback errors
      }
    }
    console.error("[seed:menu-test] failed");
    if (error && error.code === "ECONNREFUSED") {
      console.error("Database connection refused. Start MySQL/MariaDB or set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.");
    } else {
      console.error(error && error.message ? error.message : error);
    }
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

main();
