const assert = require("assert");

const { syncOutboundOrderBillingEvent } = require("../src/services/billingEvents");

function createMockConn({ billingUnit }) {
  const calls = [];
  const inserted = [];

  const conn = {
    calls,
    inserted,
    async query(sql, params = []) {
      calls.push({ sql, params });
      const normalized = sql.replace(/\s+/g, " ").trim();

      if (normalized.includes("FROM information_schema.tables")) {
        return [[{ cnt: 1 }]];
      }

      if (normalized.includes("FROM information_schema.columns")) {
        const columnName = params[1];
        const supported = new Set([
          "billing_unit",
          "billing_basis",
          "default_rate",
          "default_currency"
        ]);
        return [[{ cnt: supported.has(columnName) ? 1 : 0 }]];
      }

      if (normalized.includes("FROM outbound_orders")) {
        return [[{
          id: 9001,
          client_id: 10,
          warehouse_id: 3,
          order_date: "2026-05-18",
          shipped_at: "2026-05-18",
          status: "shipped"
        }]];
      }

      if (normalized.includes("FROM outbound_items")) {
        return [[{ qty: 3 }]];
      }

      if (normalized.includes("FROM outbound_boxes")) {
        return [[{ box_count: 2 }]];
      }

      if (normalized.includes("FROM billing_events") && normalized.startsWith("SELECT id")) {
        return [[]];
      }

      if (normalized.includes("FROM client_contract_rates")) {
        return [[]];
      }

      if (normalized.includes("FROM service_catalog")) {
        return [[{
          default_rate: 3500,
          default_currency: "KRW",
          billing_unit: billingUnit,
          billing_basis: billingUnit === "SKU" ? "QTY" : billingUnit
        }]];
      }

      if (normalized.startsWith("INSERT INTO billing_events")) {
        inserted.push(params);
        return [{ insertId: 77 }];
      }

      return [{ affectedRows: 1 }];
    }
  };

  return conn;
}

async function runCase({ billingUnit, expectedQty, expectedAmountKrw }) {
  const conn = createMockConn({ billingUnit });
  const id = await syncOutboundOrderBillingEvent(conn, 9001);
  assert.strictEqual(id, 77);
  assert.strictEqual(conn.inserted.length, 1);

  const insertParams = conn.inserted[0];
  assert.strictEqual(insertParams[4], expectedQty);
  assert.strictEqual(insertParams[5], "KRW_FIXED");
  assert.strictEqual(insertParams[8], 3500);
  assert.strictEqual(insertParams[9], expectedAmountKrw);
}

(async () => {
  await runCase({ billingUnit: "ORDER", expectedQty: 1, expectedAmountKrw: 3500 });
  await runCase({ billingUnit: "SKU", expectedQty: 3, expectedAmountKrw: 10500 });
  console.log("outbound-billing-basis-contract-ok");
})();
