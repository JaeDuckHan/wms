const http = require("http");
const path = require("path");
const express = require("express");

const dbPath = path.resolve(__dirname, "../src/db.js");

const capturedSql = [];

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, " ").trim();
}

function createMockConnection() {
  let invoiceInsertId = 8801;

  return {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      const text = normalizeSql(sql);
      capturedSql.push(text);

      if (text.includes("FROM information_schema.columns")) {
        return [[{ cnt: 1 }]];
      }

      if (text.includes("FROM information_schema.tables")) {
        return [[{ cnt: 1 }]];
      }

      if (text.startsWith("SELECT id, status FROM invoices")) {
        return [[]];
      }

      if (text.startsWith("SELECT id, rate FROM exchange_rates")) {
        return [[{ id: 7, rate: 40 }]];
      }

      if (text.startsWith("UPDATE exchange_rates SET locked = 1")) {
        return [[{ affectedRows: 1 }]];
      }

      if (text.startsWith("SELECT id, service_code, qty, pricing_policy")) {
        return [[
          {
            id: 101,
            service_code: "TH_STORAGE",
            qty: 2,
            pricing_policy: "THB_BASED",
            unit_price_thb: 100,
            amount_thb: 200,
            unit_price_krw: null,
            amount_krw: null,
          },
          {
            id: 102,
            service_code: "LEGACY_KRW",
            qty: 1,
            pricing_policy: "KRW_FIXED",
            unit_price_thb: null,
            amount_thb: null,
            unit_price_krw: 4000,
            amount_krw: 4000,
          },
        ]];
      }

      if (text.startsWith("INSERT INTO invoices")) {
        if (!text.includes("currency, fx_rate_thbkrw, subtotal_thb, vat_thb, total_thb, subtotal_krw")) {
          throw new Error(`Invoice insert must store THB primary totals before KRW totals. SQL: ${text}`);
        }
        if (!text.includes("'THB'")) {
          throw new Error(`Invoice insert must use THB currency. SQL: ${text}; Params: ${JSON.stringify(params)}`);
        }
        return [[{ insertId: invoiceInsertId }]];
      }

      if (text.startsWith("SELECT service_code")) {
        return [[
          { service_code: "TH_STORAGE", service_name: "Thailand Storage" },
          { service_code: "LEGACY_KRW", service_name: "Legacy KRW charge" },
        ]];
      }

      if (text.startsWith("UPDATE billing_events")) {
        if (!text.includes("amount_thb = ?") || !text.includes("amount_krw = ?")) {
          throw new Error(`Billing event update must store both THB and KRW. SQL: ${text}`);
        }
        return [[{ affectedRows: 1 }]];
      }

      if (text.startsWith("INSERT INTO invoice_items") && text.includes("VALUES (?, 'VAT_7'")) {
        if (!text.includes("unit_price_thb") || !text.includes("amount_thb")) {
          throw new Error(`VAT item insert must store THB and KRW. SQL: ${text}`);
        }
        return [[{ insertId: 9903 }]];
      }

      if (text.startsWith("INSERT INTO invoice_items")) {
        if (!text.includes("unit_price_thb") || !text.includes("amount_thb") || !text.includes("unit_price_krw") || !text.includes("amount_krw")) {
          throw new Error(`Invoice item insert must store THB primary and KRW converted values. SQL: ${text}`);
        }
        return [[{ insertId: 9901 }]];
      }

      if (text.startsWith("UPDATE invoices SET subtotal_thb")) {
        return [[{ affectedRows: 1 }]];
      }

      if (text.startsWith("SELECT id, client_id, invoice_no")) {
        return [[{
          id: invoiceInsertId,
          client_id: 10,
          invoice_no: "THB-10-202605-0001",
          invoice_month: "2026-05",
          invoice_date: "2026-05-15",
          currency: "THB",
          fx_rate_thbkrw: 40,
          subtotal_thb: 300,
          vat_thb: 21,
          total_thb: 321,
          subtotal_krw: 12000,
          vat_krw: 800,
          total_krw: 12800,
          status: "draft",
          created_at: "2026-05-15 00:00:00",
          updated_at: "2026-05-15 00:00:00",
        }]];
      }

      if (text.startsWith("SELECT id, last_seq FROM invoice_sequences")) {
        return [[]];
      }

      if (text.startsWith("INSERT INTO invoice_sequences")) {
        return [[{ insertId: 4401 }]];
      }

      return [[{}]];
    },
  };
}

function createMockPool() {
  return {
    async getConnection() {
      return createMockConnection();
    },
    async query(sql, params = []) {
      return createMockConnection().query(sql, params);
    },
  };
}

async function request(port, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
        },
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => resolve({ res, body: responseBody }));
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      getPool: createMockPool,
    },
  };

  const router = require("../src/routes/billingEngine");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: 1, role: "admin" };
    next();
  });
  app.use(router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const { res, body } = await request(port, "/billing/invoices", {
      client_id: 10,
      invoice_month: "2026-05",
      invoice_date: "2026-05-15",
      regenerate_draft: 0,
    });

    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}: ${body}`);
    }

    const json = JSON.parse(body);
    const invoice = json.data?.invoice;
    if (invoice.currency !== "THB") {
      throw new Error(`Expected THB invoice currency, got ${invoice.currency}`);
    }
    if (Number(invoice.subtotal_thb) !== 300 || Number(invoice.vat_thb) !== 21 || Number(invoice.total_thb) !== 321) {
      throw new Error(`Expected THB totals 300/21/321, got ${JSON.stringify(invoice)}`);
    }
    if (Number(invoice.subtotal_krw) !== 12000 || Number(invoice.vat_krw) !== 800 || Number(invoice.total_krw) !== 12800) {
      throw new Error(`Expected KRW converted totals 12000/800/12800, got ${JSON.stringify(invoice)}`);
    }
    if (!capturedSql.some((sql) => sql.startsWith("UPDATE billing_events") && sql.includes("amount_thb = ?"))) {
      throw new Error("Expected billing event updates to persist amount_thb.");
    }
    if (!capturedSql.some((sql) => sql.startsWith("INSERT INTO invoice_items") && sql.includes("amount_thb"))) {
      throw new Error("Expected invoice_items inserts to persist amount_thb.");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
