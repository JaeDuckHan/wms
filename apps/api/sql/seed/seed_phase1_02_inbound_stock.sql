SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- Phase1 integrated seed (step 2/5)
-- 목적: 입고 2건 + 입고기반 재고 반영 상태 구성

SET @client_id := (SELECT id FROM clients WHERE client_code='C101' AND deleted_at IS NULL LIMIT 1);
SET @warehouse_id := (SELECT id FROM warehouses WHERE code='WH201' AND deleted_at IS NULL LIMIT 1);
SET @loc_301_id := (
  SELECT id FROM warehouse_locations
  WHERE warehouse_id=@warehouse_id AND location_code='LOC-301' AND deleted_at IS NULL
  LIMIT 1
);
SET @manager_user_id := (SELECT id FROM users WHERE email='manager101@example.com' AND deleted_at IS NULL LIMIT 1);
SET @product_id := (SELECT id FROM products WHERE client_id=@client_id AND barcode_full='FULL401' AND deleted_at IS NULL LIMIT 1);
SET @lot_id := (SELECT id FROM product_lots WHERE product_id=@product_id AND lot_no='LOT-501' AND deleted_at IS NULL LIMIT 1);

-- Inbound order #1
INSERT INTO inbound_orders (
  id, inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at, created_at, updated_at, deleted_at
)
VALUES (
  700101, 'INB-20260301-001', @client_id, @warehouse_id, '2026-03-01', 'received',
  '3월 1차 입고(실데이터 유사 샘플)', @manager_user_id, '2026-03-01 10:30:00', NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  status=VALUES(status),
  memo=VALUES(memo),
  received_at=VALUES(received_at),
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO inbound_items (
  id, inbound_order_id, product_id, lot_id, location_id, qty, invoice_price, currency, remark, created_at, updated_at, deleted_at
)
VALUES (
  700111, 700101, @product_id, @lot_id, @loc_301_id, 120, 42.5000, 'THB', '3월초 대량 입고', NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  qty=VALUES(qty),
  invoice_price=VALUES(invoice_price),
  currency=VALUES(currency),
  remark=VALUES(remark),
  location_id=VALUES(location_id),
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO stock_transactions (
  id, client_id, product_id, lot_id, warehouse_id, location_id,
  txn_type, txn_date, qty_in, qty_out, ref_type, ref_id, note,
  created_by, created_at, updated_at, deleted_at
)
VALUES (
  700301, @client_id, @product_id, @lot_id, @warehouse_id, @loc_301_id,
  'inbound_receive', '2026-03-01 10:30:00', 120, 0, 'inbound_item', 700111,
  'INB-20260301-001 수령 완료', @manager_user_id, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  qty_in=VALUES(qty_in),
  qty_out=VALUES(qty_out),
  txn_date=VALUES(txn_date),
  note=VALUES(note),
  deleted_at=NULL,
  updated_at=NOW();

-- Inbound order #2
INSERT INTO inbound_orders (
  id, inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at, created_at, updated_at, deleted_at
)
VALUES (
  700102, 'INB-20260303-001', @client_id, @warehouse_id, '2026-03-03', 'received',
  '3월 2차 입고(보충)', @manager_user_id, '2026-03-03 15:00:00', NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  status=VALUES(status),
  memo=VALUES(memo),
  received_at=VALUES(received_at),
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO inbound_items (
  id, inbound_order_id, product_id, lot_id, location_id, qty, invoice_price, currency, remark, created_at, updated_at, deleted_at
)
VALUES (
  700112, 700102, @product_id, @lot_id, @loc_301_id, 80, 43.0000, 'THB', '추가 입고', NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  qty=VALUES(qty),
  invoice_price=VALUES(invoice_price),
  currency=VALUES(currency),
  remark=VALUES(remark),
  location_id=VALUES(location_id),
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO stock_transactions (
  id, client_id, product_id, lot_id, warehouse_id, location_id,
  txn_type, txn_date, qty_in, qty_out, ref_type, ref_id, note,
  created_by, created_at, updated_at, deleted_at
)
VALUES (
  700302, @client_id, @product_id, @lot_id, @warehouse_id, @loc_301_id,
  'inbound_receive', '2026-03-03 15:00:00', 80, 0, 'inbound_item', 700112,
  'INB-20260303-001 수령 완료', @manager_user_id, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  qty_in=VALUES(qty_in),
  qty_out=VALUES(qty_out),
  txn_date=VALUES(txn_date),
  note=VALUES(note),
  deleted_at=NULL,
  updated_at=NOW();

-- Stock balance upsert + recompute
INSERT INTO stock_balances (
  client_id, product_id, lot_id, warehouse_id, location_id, available_qty, reserved_qty, created_at, updated_at, deleted_at
)
VALUES (@client_id, @product_id, @lot_id, @warehouse_id, @loc_301_id, 0, 0, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE deleted_at=NULL, updated_at=NOW();

UPDATE stock_balances sb
SET
  sb.available_qty = (
    SELECT COALESCE(SUM(st.qty_in), 0) - COALESCE(SUM(st.qty_out), 0)
    FROM stock_transactions st
    WHERE st.client_id=@client_id
      AND st.product_id=@product_id
      AND st.lot_id=@lot_id
      AND st.warehouse_id=@warehouse_id
      AND ((st.location_id <=> @loc_301_id) OR (st.to_location_id <=> @loc_301_id) OR (st.from_location_id <=> @loc_301_id))
      AND st.deleted_at IS NULL
  ),
  sb.reserved_qty = 0,
  sb.updated_at = NOW(),
  sb.deleted_at = NULL
WHERE sb.client_id=@client_id
  AND sb.product_id=@product_id
  AND sb.lot_id=@lot_id
  AND sb.warehouse_id=@warehouse_id
  AND (sb.location_id <=> @loc_301_id)
  AND sb.deleted_at IS NULL;

SET FOREIGN_KEY_CHECKS=1;
