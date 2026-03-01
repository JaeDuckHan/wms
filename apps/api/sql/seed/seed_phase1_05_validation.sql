SET NAMES utf8mb4;

-- Phase1 integrated seed (step 5/5)
-- 목적: 운영유사 연동 체크포인트를 PASS/FAIL로 빠르게 확인

SET @client_id := (SELECT id FROM clients WHERE client_code='C101' AND deleted_at IS NULL LIMIT 1);
SET @warehouse_id := (SELECT id FROM warehouses WHERE code='WH201' AND deleted_at IS NULL LIMIT 1);
SET @loc_301_id := (
  SELECT id FROM warehouse_locations
  WHERE warehouse_id=@warehouse_id AND location_code='LOC-301' AND deleted_at IS NULL
  LIMIT 1
);
SET @product_id := (SELECT id FROM products WHERE client_id=@client_id AND barcode_full='FULL401' AND deleted_at IS NULL LIMIT 1);
SET @lot_id := (SELECT id FROM product_lots WHERE product_id=@product_id AND lot_no='LOT-501' AND deleted_at IS NULL LIMIT 1);

-- 1) high-level pass/fail
SELECT
  CASE WHEN (
    SELECT COUNT(*) FROM inbound_orders
    WHERE id IN (700101,700102) AND status='received' AND deleted_at IS NULL
  ) = 2 THEN 'PASS' ELSE 'FAIL' END AS inbound_received,

  CASE WHEN (
    SELECT COUNT(*) FROM outbound_orders
    WHERE id=700201 AND status='shipped' AND deleted_at IS NULL
  ) = 1 THEN 'PASS' ELSE 'FAIL' END AS outbound_shipped,

  CASE WHEN (
    SELECT COUNT(*) FROM service_events
    WHERE id IN (700401,700402) AND deleted_at IS NULL
  ) = 2 THEN 'PASS' ELSE 'FAIL' END AS service_events_ready,

  CASE WHEN (
    SELECT status FROM settlement_batches WHERE id=700501 AND deleted_at IS NULL
  ) = 'closed' THEN 'PASS' ELSE 'FAIL' END AS settlement_closed,

  CASE WHEN (
    SELECT status FROM invoices WHERE id=700601 AND deleted_at IS NULL
  ) = 'sent' THEN 'PASS' ELSE 'FAIL' END AS invoice_sent,

  CASE WHEN (
    SELECT COALESCE(i.total_amount,0) - COALESCE((
      SELECT SUM(il.total_amount)
      FROM invoice_lines il
      WHERE il.invoice_id=i.id AND il.deleted_at IS NULL
    ),0)
    FROM invoices i
    WHERE i.id=700601 AND i.deleted_at IS NULL
  ) = 0 THEN 'PASS' ELSE 'FAIL' END AS invoice_amount_match;

-- 2) stock snapshot (가용/예약)
SELECT
  sb.client_id,
  sb.product_id,
  sb.lot_id,
  sb.warehouse_id,
  sb.location_id,
  sb.available_qty,
  sb.reserved_qty,
  (
    SELECT COALESCE(SUM(st.qty_in),0) - COALESCE(SUM(st.qty_out),0)
    FROM stock_transactions st
    WHERE st.client_id=sb.client_id
      AND st.product_id=sb.product_id
      AND st.lot_id=sb.lot_id
      AND st.warehouse_id=sb.warehouse_id
      AND ((st.location_id <=> sb.location_id) OR (st.to_location_id <=> sb.location_id) OR (st.from_location_id <=> sb.location_id))
      AND st.deleted_at IS NULL
  ) AS txn_net_qty
FROM stock_balances sb
WHERE sb.client_id=@client_id
  AND sb.product_id=@product_id
  AND sb.lot_id=@lot_id
  AND sb.warehouse_id=@warehouse_id
  AND (sb.location_id <=> @loc_301_id)
  AND sb.deleted_at IS NULL;

-- 3) settlement/invoice summary
SELECT
  sb.id AS settlement_batch_id,
  sb.billing_month,
  sb.status AS settlement_status,
  sb.total_krw,
  i.id AS invoice_id,
  i.invoice_no,
  i.status AS invoice_status,
  i.total_amount AS invoice_total_krw
FROM settlement_batches sb
LEFT JOIN invoices i ON i.settlement_batch_id=sb.id AND i.deleted_at IS NULL
WHERE sb.id=700501
  AND sb.deleted_at IS NULL;
