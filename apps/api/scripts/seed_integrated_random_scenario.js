const dotenv = require("dotenv");
const { getPool } = require("../src/db");

dotenv.config();

const INBOUND_STATUSES = ["draft", "submitted", "arrived", "qc_hold", "received", "cancelled"];
const OUTBOUND_STATUSES = ["draft", "confirmed", "allocated", "picking", "packed", "shipped", "delivered", "cancelled"];
const SALES_CHANNELS = ["Naver SmartStore", "Coupang", "Kurly", "11st", "Musinsa Beauty", "Ably"];

const INBOUND_COUNT = Number(process.env.SEED_SCENARIO_INBOUND_COUNT || 36);
const OUTBOUND_COUNT = Number(process.env.SEED_SCENARIO_OUTBOUND_COUNT || 36);

let seed = Number(process.env.SEED_SCENARIO_SEED || 20260302);

function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

function pad2(v) {
  return String(v).padStart(2, "0");
}

function pad4(v) {
  return String(v).padStart(4, "0");
}

function formatDate(d) {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

function formatDateTime(d) {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  const sec = pad2(d.getUTCSeconds());
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

function daysAgo(days) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function qtyInbound() {
  return 80 + Math.floor(rand() * 220);
}

function qtyOutbound(maxSafe) {
  if (maxSafe <= 0) return 0;
  const low = Math.max(10, Math.floor(maxSafe * 0.25));
  const high = Math.max(low, Math.floor(maxSafe * 0.7));
  return low + Math.floor(rand() * (high - low + 1));
}

async function hasTable(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function hasColumn(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function ensureBillingSettings(conn, clientIds) {
  const hasServiceName = await hasColumn(conn, "service_catalog", "service_name");
  const hasBillingUnit = await hasColumn(conn, "service_catalog", "billing_unit");
  const hasPricingPolicy = await hasColumn(conn, "service_catalog", "pricing_policy");
  const hasDefaultRate = await hasColumn(conn, "service_catalog", "default_rate");

  const services = [
    {
      service_code: "INBOUND_FEE",
      service_name_kr: "입고 처리비",
      service_name: "Inbound Handling Fee",
      billing_basis: "QTY",
      billing_unit: "SKU",
      pricing_policy: "KRW_FIXED",
      default_currency: "KRW",
      default_rate: 1800,
      status: "active"
    },
    {
      service_code: "OUTBOUND_FEE",
      service_name_kr: "출고 처리비",
      service_name: "Outbound Handling Fee",
      billing_basis: "QTY",
      billing_unit: "SKU",
      pricing_policy: "KRW_FIXED",
      default_currency: "KRW",
      default_rate: 3500,
      status: "active"
    },
    {
      service_code: "TH_SHIPPING",
      service_name_kr: "배송비(THB)",
      service_name: "Shipping Fee (THB)",
      billing_basis: "ORDER",
      billing_unit: "ORDER",
      pricing_policy: "THB_BASED",
      default_currency: "THB",
      default_rate: 120,
      status: "active"
    }
  ];

  for (const row of services) {
    const columns = ["service_code", "service_name_kr", "billing_basis", "default_currency", "status"];
    const values = [row.service_code, row.service_name_kr, row.billing_basis, row.default_currency, row.status];

    if (hasServiceName) {
      columns.push("service_name");
      values.push(row.service_name);
    }
    if (hasBillingUnit) {
      columns.push("billing_unit");
      values.push(row.billing_unit);
    }
    if (hasPricingPolicy) {
      columns.push("pricing_policy");
      values.push(row.pricing_policy);
    }
    if (hasDefaultRate) {
      columns.push("default_rate");
      values.push(row.default_rate);
    }

    const placeholders = columns.map(() => "?").join(", ");
    const updates = columns
      .filter((c) => c !== "service_code")
      .map((c) => `${c}=VALUES(${c})`)
      .join(", ");
    await conn.query(
      `INSERT INTO service_catalog (${columns.join(", ")})
       VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updates}`,
      values
    );
  }

  const hasClientContract = await hasTable(conn, "client_contract_rates");
  if (hasClientContract) {
    const today = formatDate(new Date());
    for (const clientId of clientIds) {
      await conn.query(
        `INSERT INTO client_contract_rates (client_id, service_code, custom_rate, currency, effective_date)
         VALUES (?, 'INBOUND_FEE', 1700, 'KRW', ?),
                (?, 'OUTBOUND_FEE', 3200, 'KRW', ?)
         ON DUPLICATE KEY UPDATE custom_rate = VALUES(custom_rate), currency = VALUES(currency)`,
        [clientId, today, clientId, today]
      );
    }
  }

  const hasExchangeRates = await hasTable(conn, "exchange_rates");
  if (hasExchangeRates) {
    const hasSource = await hasColumn(conn, "exchange_rates", "source");
    const hasLocked = await hasColumn(conn, "exchange_rates", "locked");
    const hasActivatedBy = await hasColumn(conn, "exchange_rates", "activated_by");
    const hasActivatedAt = await hasColumn(conn, "exchange_rates", "activated_at");

    const [adminRows] = await conn.query(
      `SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`
    );
    const enteredBy = Number(adminRows[0]?.id || 1);
    const today = formatDate(new Date());

    const columns = ["base_currency", "quote_currency", "rate", "rate_date", "status", "entered_by"];
    const values = ["THB", "KRW", 39.25, today, "active", enteredBy];

    if (hasSource) {
      columns.push("source");
      values.push("manual");
    }
    if (hasLocked) {
      columns.push("locked");
      values.push(0);
    }
    if (hasActivatedBy) {
      columns.push("activated_by");
      values.push(enteredBy);
    }
    if (hasActivatedAt) {
      columns.push("activated_at");
      values.push(formatDateTime(new Date()));
    }

    const placeholders = columns.map(() => "?").join(", ");
    const updates = ["rate=VALUES(rate)", "status=VALUES(status)", "entered_by=VALUES(entered_by)"];
    if (hasSource) updates.push("source=VALUES(source)");
    if (hasLocked) updates.push("locked=VALUES(locked)");
    if (hasActivatedBy) updates.push("activated_by=VALUES(activated_by)");
    if (hasActivatedAt) updates.push("activated_at=VALUES(activated_at)");

    await conn.query(
      `INSERT INTO exchange_rates (${columns.join(", ")})
       VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
      values
    );
  }
}

function keyOf(clientId, productId, lotId, warehouseId, locationId) {
  return `${clientId}:${productId}:${lotId}:${warehouseId}:${locationId}`;
}

async function main() {
  const conn = await getPool().getConnection();
  const runTag = `SIM${Date.now()}`;

  try {
    await conn.beginTransaction();

    const [warehouseRows] = await conn.query(
      `SELECT id, code FROM warehouses WHERE deleted_at IS NULL AND status = 'active' ORDER BY id ASC`
    );
    if (warehouseRows.length === 0) {
      throw new Error("No active warehouse found. Seed warehouse first.");
    }
    const warehouseId = Number(warehouseRows[0].id);

    const [locationRows] = await conn.query(
      `SELECT id, location_code
       FROM warehouse_locations
       WHERE warehouse_id = ? AND deleted_at IS NULL AND status = 'active'
       ORDER BY id ASC`,
      [warehouseId]
    );
    if (locationRows.length === 0) {
      throw new Error("No active warehouse location found.");
    }

    const [userRows] = await conn.query(
      `SELECT id FROM users WHERE role IN ('admin','manager') AND deleted_at IS NULL AND status = 'active' ORDER BY id ASC LIMIT 1`
    );
    if (userRows.length === 0) {
      throw new Error("No active admin/manager user found.");
    }
    const createdBy = Number(userRows[0].id);

    const [catalogRows] = await conn.query(
      `SELECT c.id AS client_id, c.client_code, c.name_kr,
              p.id AS product_id, p.name_kr AS product_name,
              pl.id AS lot_id, pl.lot_no
       FROM clients c
       JOIN products p ON p.client_id = c.id AND p.deleted_at IS NULL AND p.status = 'active'
       JOIN product_lots pl ON pl.product_id = p.id AND pl.deleted_at IS NULL
       WHERE c.deleted_at IS NULL AND c.status = 'active'
       ORDER BY c.id ASC, p.id ASC, pl.id ASC`
    );
    if (catalogRows.length === 0) {
      throw new Error("No active client/product/lot set found.");
    }

    const byClient = new Map();
    for (const row of catalogRows) {
      const key = Number(row.client_id);
      if (!byClient.has(key)) byClient.set(key, []);
      byClient.get(key).push(row);
    }
    const clientIds = Array.from(byClient.keys());

    await ensureBillingSettings(conn, clientIds);

    const stockMap = new Map();
    const inboundCreated = [];
    const outboundCreated = [];

    for (let i = 1; i <= INBOUND_COUNT; i += 1) {
      const clientId = pick(clientIds);
      const itemCatalog = pick(byClient.get(clientId));
      const loc = pick(locationRows);
      const status = INBOUND_STATUSES[(i - 1 + Math.floor(rand() * 3)) % INBOUND_STATUSES.length];
      const qty = qtyInbound();
      const inboundDate = formatDate(daysAgo(70 - (i % 45)));
      const inboundNo = `${runTag}-IB-${pad4(i)}`;
      const receivedAt = status === "received" ? formatDateTime(new Date(`${inboundDate}T10:00:00Z`)) : null;

      const [orderResult] = await conn.query(
        `INSERT INTO inbound_orders
          (inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inboundNo,
          clientId,
          warehouseId,
          inboundDate,
          status,
          `[SIMDATA] Cosmetics inbound scenario ${i}`,
          createdBy,
          receivedAt
        ]
      );
      const inboundOrderId = Number(orderResult.insertId);

      const [itemResult] = await conn.query(
        `INSERT INTO inbound_items
          (inbound_order_id, product_id, lot_id, location_id, qty, invoice_price, currency, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inboundOrderId,
          Number(itemCatalog.product_id),
          Number(itemCatalog.lot_id),
          Number(loc.id),
          qty,
          18.5,
          "THB",
          "[SIMDATA] inbound item"
        ]
      );
      const inboundItemId = Number(itemResult.insertId);

      inboundCreated.push({ inboundOrderId, inboundItemId, clientId, qty, status, inboundDate });

      if (status === "received") {
        const balanceKey = keyOf(clientId, itemCatalog.product_id, itemCatalog.lot_id, warehouseId, loc.id);
        const prev = Number(stockMap.get(balanceKey) || 0);
        stockMap.set(balanceKey, prev + qty);

        await conn.query(
          `INSERT INTO stock_transactions
            (client_id, product_id, lot_id, warehouse_id, location_id, txn_type, txn_date, qty_in, qty_out, ref_type, ref_id, note, created_by)
           VALUES (?, ?, ?, ?, ?, 'inbound_receive', ?, ?, 0, 'inbound_item', ?, ?, ?)`,
          [
            clientId,
            Number(itemCatalog.product_id),
            Number(itemCatalog.lot_id),
            warehouseId,
            Number(loc.id),
            `${inboundDate} 10:30:00`,
            qty,
            inboundItemId,
            "[SIMDATA] inbound stock txn",
            createdBy
          ]
        );
      }
    }

    const stockKeys = Array.from(stockMap.keys());
    for (let i = 1; i <= OUTBOUND_COUNT; i += 1) {
      const candidateKey = stockKeys.length > 0 ? pick(stockKeys) : null;
      const defaultCatalog = pick(catalogRows);

      let clientId = Number(defaultCatalog.client_id);
      let productId = Number(defaultCatalog.product_id);
      let lotId = Number(defaultCatalog.lot_id);
      let locationId = Number(pick(locationRows).id);

      if (candidateKey) {
        const [cid, pid, lid, _wid, locid] = candidateKey.split(":").map(Number);
        clientId = cid;
        productId = pid;
        lotId = lid;
        locationId = locid;
      }

      const outboundDate = formatDate(daysAgo(45 - (i % 32)));
      let status = OUTBOUND_STATUSES[(i - 1 + Math.floor(rand() * 4)) % OUTBOUND_STATUSES.length];

      const balanceKey = keyOf(clientId, productId, lotId, warehouseId, locationId);
      const safeQty = Number(stockMap.get(balanceKey) || 0);
      if ((status === "shipped" || status === "delivered") && safeQty <= 0) {
        status = "packed";
      }

      const qty = status === "shipped" || status === "delivered" ? qtyOutbound(safeQty) : 20 + Math.floor(rand() * 60);
      const boxCount = Math.max(1, Math.ceil(qty / 25));
      const outboundNo = `${runTag}-OB-${pad4(i)}`;
      const orderNo = `${pick(["NVR", "CPG", "SSG", "KUR", "MUS", "ABL"])}-${new Date().getUTCFullYear()}${pad2(new Date().getUTCMonth() + 1)}${pad2((i % 28) + 1)}-${pad4(i)}`;
      const trackingNo = `${pick(["CJ", "HJ", "LT", "EP"])}${Math.floor(1000000000 + rand() * 8999999999)}KR`;
      const packedAt = ["packed", "shipped", "delivered"].includes(status) ? `${outboundDate} 13:20:00` : null;
      const shippedAt = ["shipped", "delivered"].includes(status) ? `${outboundDate} 15:00:00` : null;

      const [orderResult] = await conn.query(
        `INSERT INTO outbound_orders
          (outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status, packed_at, shipped_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          outboundNo,
          clientId,
          warehouseId,
          outboundDate,
          pick(SALES_CHANNELS),
          orderNo,
          trackingNo,
          status,
          packedAt,
          shippedAt,
          createdBy
        ]
      );
      const outboundOrderId = Number(orderResult.insertId);

      const [itemResult] = await conn.query(
        `INSERT INTO outbound_items
          (outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          outboundOrderId,
          productId,
          lotId,
          locationId,
          qty,
          "corrugated_small",
          boxCount,
          "[SIMDATA] outbound item"
        ]
      );
      const outboundItemId = Number(itemResult.insertId);

      outboundCreated.push({ outboundOrderId, outboundItemId, clientId, qty, status, outboundDate, boxCount });

      if (status === "shipped" || status === "delivered") {
        stockMap.set(balanceKey, Math.max(0, safeQty - qty));
        await conn.query(
          `INSERT INTO stock_transactions
            (client_id, product_id, lot_id, warehouse_id, location_id, from_location_id, txn_type, txn_date, qty_in, qty_out, ref_type, ref_id, note, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 'outbound_ship', ?, 0, ?, 'outbound_item', ?, ?, ?)`,
          [
            clientId,
            productId,
            lotId,
            warehouseId,
            locationId,
            locationId,
            `${outboundDate} 15:10:00`,
            qty,
            outboundItemId,
            "[SIMDATA] outbound stock txn",
            createdBy
          ]
        );
      }
    }

    for (const [k, availableQty] of stockMap.entries()) {
      const [clientId, productId, lotId, warehouseIdKey, locationId] = k.split(":").map(Number);
      await conn.query(
        `INSERT INTO stock_balances
          (client_id, product_id, lot_id, warehouse_id, location_id, available_qty, reserved_qty)
         VALUES (?, ?, ?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE available_qty = VALUES(available_qty), reserved_qty = 0, deleted_at = NULL`,
        [clientId, productId, lotId, warehouseIdKey, locationId, availableQty]
      );
    }

    if (await hasTable(conn, "billing_events")) {
      const hasWarehouseId = await hasColumn(conn, "billing_events", "warehouse_id");
      const hasStatus = await hasColumn(conn, "billing_events", "status");
      const hasInvoiceId = await hasColumn(conn, "billing_events", "invoice_id");
      const hasFxRate = await hasColumn(conn, "billing_events", "fx_rate_thbkrw");

      for (const row of inboundCreated) {
        if (row.status !== "received") continue;
        const columns = ["client_id", "service_code", "reference_type", "reference_id", "event_date", "qty", "pricing_policy", "unit_price_krw", "amount_krw"];
        const values = [row.clientId, "INBOUND_FEE", "INBOUND", String(row.inboundOrderId), row.inboundDate, row.qty, "KRW_FIXED", 1800, row.qty * 1800];
        if (hasWarehouseId) {
          columns.splice(1, 0, "warehouse_id");
          values.splice(1, 0, warehouseId);
        }
        if (hasFxRate) {
          columns.push("fx_rate_thbkrw");
          values.push(39.25);
        }
        if (hasInvoiceId) {
          columns.push("invoice_id");
          values.push(null);
        }
        if (hasStatus) {
          columns.push("status");
          values.push("PENDING");
        }
        await conn.query(
          `INSERT INTO billing_events (${columns.join(", ")})
           VALUES (${columns.map(() => "?").join(", ")})`,
          values
        );
      }

      for (const row of outboundCreated) {
        if (!(row.status === "shipped" || row.status === "delivered")) continue;
        const events = [
          {
            service_code: "OUTBOUND_FEE",
            pricing_policy: "KRW_FIXED",
            unit_price_krw: 3200,
            amount_krw: row.qty * 3200,
            unit_price_thb: null,
            amount_thb: null
          },
          {
            service_code: "TH_SHIPPING",
            pricing_policy: "THB_BASED",
            unit_price_krw: null,
            amount_krw: null,
            unit_price_thb: 120,
            amount_thb: 120
          }
        ];

        for (const evt of events) {
          const columns = [
            "client_id",
            "service_code",
            "reference_type",
            "reference_id",
            "event_date",
            "qty",
            "pricing_policy",
            "unit_price_thb",
            "amount_thb",
            "unit_price_krw",
            "amount_krw"
          ];
          const values = [
            row.clientId,
            evt.service_code,
            "OUTBOUND",
            String(row.outboundOrderId),
            row.outboundDate,
            evt.service_code === "OUTBOUND_FEE" ? row.qty : 1,
            evt.pricing_policy,
            evt.unit_price_thb,
            evt.amount_thb,
            evt.unit_price_krw,
            evt.amount_krw
          ];
          if (hasWarehouseId) {
            columns.splice(1, 0, "warehouse_id");
            values.splice(1, 0, warehouseId);
          }
          if (hasFxRate) {
            columns.push("fx_rate_thbkrw");
            values.push(39.25);
          }
          if (hasInvoiceId) {
            columns.push("invoice_id");
            values.push(null);
          }
          if (hasStatus) {
            columns.push("status");
            values.push("PENDING");
          }
          await conn.query(
            `INSERT INTO billing_events (${columns.join(", ")})
             VALUES (${columns.map(() => "?").join(", ")})`,
            values
          );
        }
      }
    }

    await conn.commit();

    console.log(JSON.stringify({
      ok: true,
      run_tag: runTag,
      warehouse_id: warehouseId,
      inbound_orders_created: INBOUND_COUNT,
      outbound_orders_created: OUTBOUND_COUNT,
      stock_balance_keys_upserted: stockMap.size
    }, null, 2));
  } catch (error) {
    await conn.rollback();
    console.error("[seed:scenario:integrated] failed:", error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
  }
}

main();
