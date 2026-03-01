#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const seedFiles = [
  'sql/seed/seed_testpack_base.sql',
  'sql/seed/seed_phase1_01_master.sql',
  'sql/seed/seed_phase1_02_inbound_stock.sql',
  'sql/seed/seed_phase1_03_outbound_service.sql',
  'sql/seed/seed_phase1_04_settlement_invoice.sql',
  'sql/seed/seed_phase1_05_validation.sql'
];

function resolveSeedPath(relPath) {
  const appRootFromScript = path.resolve(__dirname, '..');
  const candidates = [
    path.resolve(process.cwd(), relPath),
    path.resolve(appRootFromScript, relPath)
  ];

  for (const abs of candidates) {
    if (fs.existsSync(abs)) return abs;
  }

  throw new Error(
    `Seed SQL file not found: ${relPath}\n` +
      `Checked:\n- ${candidates.join('\n- ')}\n` +
      `Run from apps/api, or ensure apps/api/sql/seed exists.`
  );
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wms_test',
    multipleStatements: true
  });

  try {
    for (const rel of seedFiles) {
      const abs = resolveSeedPath(rel);
      const sql = fs.readFileSync(abs, 'utf8');
      await conn.query(sql);
      console.log(`[OK] ${rel} -> ${abs}`);
    }

    const [passRows] = await conn.query(`
      SELECT
        CASE WHEN (SELECT COUNT(*) FROM inbound_orders WHERE id IN (700101,700102) AND status='received' AND deleted_at IS NULL)=2 THEN 'PASS' ELSE 'FAIL' END AS inbound_received,
        CASE WHEN (SELECT COUNT(*) FROM outbound_orders WHERE id=700201 AND status='shipped' AND deleted_at IS NULL)=1 THEN 'PASS' ELSE 'FAIL' END AS outbound_shipped,
        CASE WHEN (SELECT COUNT(*) FROM service_events WHERE id IN (700401,700402) AND deleted_at IS NULL)=2 THEN 'PASS' ELSE 'FAIL' END AS service_events_ready,
        CASE WHEN (SELECT status FROM settlement_batches WHERE id=700501 AND deleted_at IS NULL)='closed' THEN 'PASS' ELSE 'FAIL' END AS settlement_closed,
        CASE WHEN (SELECT status FROM invoices WHERE id=700601 AND deleted_at IS NULL)='sent' THEN 'PASS' ELSE 'FAIL' END AS invoice_sent,
        CASE WHEN (
          SELECT COALESCE(i.total_amount,0) - COALESCE((SELECT SUM(il.total_amount) FROM invoice_lines il WHERE il.invoice_id=i.id AND il.deleted_at IS NULL),0)
          FROM invoices i WHERE i.id=700601 AND i.deleted_at IS NULL
        ) = 0 THEN 'PASS' ELSE 'FAIL' END AS invoice_amount_match
    `);

    console.log('\n=== VALIDATION ===');
    console.table(passRows);

    const [summaryRows] = await conn.query(`
      SELECT sb.id AS settlement_batch_id, sb.billing_month, sb.status AS settlement_status, sb.total_krw,
             i.id AS invoice_id, i.invoice_no, i.status AS invoice_status, i.total_amount AS invoice_total_krw
      FROM settlement_batches sb
      LEFT JOIN invoices i ON i.settlement_batch_id=sb.id AND i.deleted_at IS NULL
      WHERE sb.id=700501 AND sb.deleted_at IS NULL
    `);

    console.log('\n=== SUMMARY ===');
    console.table(summaryRows);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[ERROR] seed_phase1_integrated failed');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
