const http = require("http");
const path = require("path");
const express = require("express");

const dbPath = path.resolve(__dirname, "../src/db.js");

const tablePresence = new Map([
  ["invoices", true],
  ["billing_events", true],
  ["invoice_items", true],
  ["invoice_export_logs", false],
]);

function createMockPool() {
  return {
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, " ").trim();

      if (text.includes("FROM information_schema.tables")) {
        const tableName = String(params[0] || "");
        return [[{ cnt: tablePresence.get(tableName) ? 1 : 0 }]];
      }

      if (text.includes("FROM information_schema.columns")) {
        return [[{ cnt: 1 }]];
      }

      if (text.startsWith("SELECT i.id, i.client_id")) {
        return [[
          {
            id: 1,
            client_id: 10,
            client_code: "CL10",
            name_kr: "Test Client",
            invoice_no: "INV-TEST-001",
            invoice_month: "2026-05",
            invoice_date: "2026-05-15",
            currency: "KRW",
            fx_rate_thbkrw: 39.125,
            subtotal_thb: 100,
            subtotal_krw: 3900,
            vat_krw: 200,
            total_krw: 4100,
            status: "issued",
            created_at: "2026-05-15 00:00:00",
            updated_at: "2026-05-15 00:00:00",
            subtotal_trunc100: 1,
            vat_trunc100: 1,
            total_trunc100: 1,
          },
        ]];
      }

      if (text.includes("FROM invoice_items")) {
        return [[
          {
            id: 101,
            invoice_id: 1,
            service_code: "OUTBOUND_FEE",
            description: "Outbound handling",
            qty: 1,
            unit_price_krw: 3900,
            amount_krw: 3900,
            created_at: "2026-05-15 00:00:00",
            updated_at: "2026-05-15 00:00:00",
            unit_price_trunc100: 1,
            amount_trunc100: 1,
          },
        ]];
      }

      if (text.startsWith("INSERT INTO invoice_export_logs")) {
        const error = new Error("Table 'wms_test.invoice_export_logs' doesn't exist");
        error.code = "ER_NO_SUCH_TABLE";
        throw error;
      }

      return [[{}]];
    },
  };
}

async function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "GET",
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ res, body }));
      }
    );
    req.on("error", reject);
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
    const { res, body } = await request(port, "/billing/invoices/1/export-pdf?download=1");

    if (res.statusCode !== 200) {
      throw new Error(`Expected 200 export response, got ${res.statusCode}: ${body}`);
    }
    const contentType = String(res.headers["content-type"] || "");
    if (!contentType.includes("text/html")) {
      throw new Error(`Expected text/html export response, got ${contentType}`);
    }
    const disposition = String(res.headers["content-disposition"] || "");
    if (!disposition.includes("attachment")) {
      throw new Error(`Expected attachment content-disposition, got ${disposition}`);
    }
    if (!body.includes("INV-TEST-001")) {
      throw new Error("Expected invoice number in export body");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
