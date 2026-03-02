const mysql = require("mysql2/promise");

let pool;
const BILLING_REQUIRED_TABLES = [
  "billing_events",
  "invoices",
  "invoice_items",
  "exchange_rates",
  "service_catalog"
];

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "wms_test",
      waitForConnections: true,
      connectionLimit: 10
    });
  }

  return pool;
}

async function pingDb() {
  const [rows] = await getPool().query(
    "SELECT DATABASE() AS db, NOW() AS server_time"
  );
  return rows[0];
}

async function getTablePresence(tableNames) {
  if (!Array.isArray(tableNames) || tableNames.length === 0) {
    return {};
  }

  const normalized = Array.from(
    new Set(tableNames.map((name) => String(name || "").trim()).filter(Boolean))
  );
  if (normalized.length === 0) {
    return {};
  }

  const placeholders = normalized.map(() => "?").join(", ");
  const [rows] = await getPool().query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN (${placeholders})`,
    normalized
  );

  const existing = new Set(rows.map((row) => String(row.table_name)));
  const result = {};
  for (const name of normalized) {
    result[name] = existing.has(name);
  }
  return result;
}

async function getBillingSchemaReadiness() {
  const presence = await getTablePresence(BILLING_REQUIRED_TABLES);
  const missing = BILLING_REQUIRED_TABLES.filter((name) => !presence[name]);
  return {
    ready: missing.length === 0,
    required_tables: BILLING_REQUIRED_TABLES,
    missing_tables: missing,
    table_presence: presence
  };
}

module.exports = {
  BILLING_REQUIRED_TABLES,
  getPool,
  pingDb,
  getBillingSchemaReadiness
};
