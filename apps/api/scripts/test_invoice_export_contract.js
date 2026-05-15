const http = require("http");
const fs = require("fs");
const path = require("path");
const express = require("express");

const dbPath = path.resolve(__dirname, "../src/db.js");
const localTtcFontPath = "C:\\Windows\\Fonts\\gulim.ttc";

if (fs.existsSync(localTtcFontPath)) {
  process.env.PDF_FONT_PATH = localTtcFontPath;
  process.env.PDF_FONT_POSTSCRIPT_NAME = "Gulim";
}

const tablePresence = new Map([
  ["invoices", true],
  ["billing_events", true],
  ["invoice_items", true],
  ["invoice_export_logs", true],
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
            name_kr: "안마재테스트 주식회사",
            invoice_no: "MENU-HIST-116-202604-0001",
            invoice_month: "2026-05",
            invoice_date: "2026-05-15",
            currency: "THB",
            fx_rate_thbkrw: 39.125,
            subtotal_thb: 0,
            vat_thb: 0,
            total_thb: 0,
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
            description: "출고 처리 / Outbound handling",
            qty: 1,
            unit_price_thb: 100,
            amount_thb: 100,
            unit_price_krw: 3900,
            amount_krw: 3900,
            created_at: "2026-05-15 00:00:00",
            updated_at: "2026-05-15 00:00:00",
            unit_price_trunc100: 1,
            amount_trunc100: 1,
          },
          {
            id: 102,
            invoice_id: 1,
            service_code: "VAT_7",
            description: "VAT 7%",
            qty: 1,
            unit_price_thb: 7,
            amount_thb: 7,
            unit_price_krw: 200,
            amount_krw: 200,
            created_at: "2026-05-15 00:00:00",
            updated_at: "2026-05-15 00:00:00",
            unit_price_trunc100: 1,
            amount_trunc100: 1,
          },
        ]];
      }

      if (text.startsWith("INSERT INTO invoice_export_logs")) {
        if (!text.includes("VALUES (?, 'pdf'")) {
          throw new Error(`Expected invoice export log format pdf, got SQL: ${text}`);
        }
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
        const chunks = [];
        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
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
    const detail = await request(port, "/billing/invoices/1");
    const detailBody = detail.body.toString("utf8");
    const detailJson = JSON.parse(detailBody);
    if (detail.res.statusCode !== 200 || !detailJson.ok) {
      throw new Error(`Expected 200 detail response, got ${detail.res.statusCode}: ${detailBody}`);
    }
    const invoice = detailJson.data.invoice;
    if (Number(invoice.subtotal_thb) !== 100 || Number(invoice.vat_thb) !== 7 || Number(invoice.total_thb) !== 107) {
      throw new Error(
        `Expected detail THB totals to be derived from invoice items, got subtotal=${invoice.subtotal_thb}, vat=${invoice.vat_thb}, total=${invoice.total_thb}`
      );
    }

    const metadata = await request(port, "/billing/invoices/1/export-pdf");
    const metadataBody = metadata.body.toString("utf8");
    const metadataJson = JSON.parse(metadataBody);
    if (metadata.res.statusCode !== 200 || !metadataJson.ok) {
      throw new Error(`Expected 200 metadata response, got ${metadata.res.statusCode}: ${metadataBody}`);
    }
    if (metadataJson.data.content_type !== "application/pdf") {
      throw new Error(`Expected application/pdf metadata, got ${metadataJson.data.content_type}`);
    }
    if (!String(metadataJson.data.file_name || "").endsWith(".pdf")) {
      throw new Error(`Expected .pdf metadata file name, got ${metadataJson.data.file_name}`);
    }

    const { res, body } = await request(port, "/billing/invoices/1/export-pdf?download=1");

    if (res.statusCode !== 200) {
      throw new Error(`Expected 200 export response, got ${res.statusCode}: ${body.toString("utf8")}`);
    }
    const contentType = String(res.headers["content-type"] || "");
    if (!contentType.includes("application/pdf")) {
      throw new Error(`Expected application/pdf export response, got ${contentType}`);
    }
    const disposition = String(res.headers["content-disposition"] || "");
    if (!disposition.includes("inline")) {
      throw new Error(`Expected inline content-disposition for browser preview, got ${disposition}`);
    }
    if (!disposition.includes(".pdf")) {
      throw new Error(`Expected .pdf content-disposition, got ${disposition}`);
    }
    if (body.slice(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error(`Expected PDF binary body, got first bytes ${body.slice(0, 16).toString("hex")}`);
    }
    if (body.includes(Buffer.from("????", "ascii"))) {
      throw new Error("Expected Korean invoice text not to be exported as question marks.");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
