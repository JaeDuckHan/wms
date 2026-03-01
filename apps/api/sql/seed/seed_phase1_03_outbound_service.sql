SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- Phase1 integrated seed (step 3/5)
-- 목적: 출고/예약 재고 + 서비스 이벤트(정산 원천) 구성

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
SET @svc_box_id := (SELECT id FROM service_catalog WHERE service_code='SV_OUTBOUND_BOX' AND deleted_at IS NULL LIMIT 1);
SET @svc_order_id := (SELECT id FROM service_catalog WHERE service_code='SV_OUTBOUND_ORDER' AND deleted_at IS NULL LIMIT 1);

SET @box_unit_krw := COALESCE((
  SELECT pp.unit_price
  FROM price_policies pp
  WHERE pp.client_id=@client_id
    AND pp.service_id=@svc_box_id
    AND pp.effective_from <= '2026-03-10'
    AND (pp.effective_to IS NULL OR pp.effective_to >= '2026-03-10')
    AND pp.deleted_at IS NULL
  ORDER BY pp.effective_from DESC
  LIMIT 1
), 700.0000);

SET @order_unit_krw := COALESCE((
  SELECT pp.unit_price
  FROM price_policies pp
  WHERE pp.client_id=@client_id
    AND pp.service_id=@svc_order_id
    AND pp.effective_from <= '2026-03-10'
    AND (pp.effective_to IS NULL OR pp.effective_to >= '2026-03-10')
    AND pp.deleted_at IS NULL
  ORDER BY pp.effective_from DESC
  LIMIT 1
), 3500.0000);

-- Shipped outbound (재고 차감 + 정산 원천 이벤트 생성)
INSERT INTO outbound_orders (
  id, outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no,
  status, packed_at, shipped_at, created_by, created_at, updated_at, deleted_at
)
VALUES (
  700201, 'OUT-20260310-001', @client_id, @warehouse_id, '2026-03-10', 'COUPANG', 'ORD-20260310-001', 'TRK-20260310-001',
  'shipped', '2026-03-10 09:00:00', '2026-03-10 11:30:00', @manager_user_id, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  status=VALUES(status),
  sales_channel=VALUES(sales_channel),
  order_no=VALUES(order_no),
  tracking_no=VALUES(tracking_no),
  packed_at=VALUES(packed_at),
  shipped_at=VALUES(shipped_at),
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO outbound_items (
  id, outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at, deleted_at
)
VALUES (
  700211, 700201, @product_id, @lot_id, @loc_301_id, 70, 'PACK_BOX_AA', 7, '출고 완료 건', NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  qty=VALUES(qty),
  box_type=VALUES(box_type),
  box_count=VALUES(box_count),
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
  700303, @client_id, @product_id, @lot_id, @warehouse_id, @loc_301_id,
  'outbound_ship', '2026-03-10 11:30:00', 0, 70, 'outbound_item', 700211,
  'OUT-20260310-001 shipped', @manager_user_id, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  qty_in=VALUES(qty_in),
  qty_out=VALUES(qty_out),
  txn_date=VALUES(txn_date),
  note=VALUES(note),
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO service_events (
  id, client_id, service_id, outbound_order_id, stock_transaction_id,
  event_date, source_type, basis_applied, qty, box_count,
  unit_price, amount, currency, remark, created_at, updated_at, deleted_at
)
VALUES
  (
    700401, @client_id, @svc_box_id, 700201, 700303,
    '2026-03-10 11:31:00', 'outbound_shipped', 'BOX', 0, 7,
    @box_unit_krw, ROUND(7 * @box_unit_krw, 4), 'KRW', '박스 과금 이벤트', NOW(), NOW(), NULL
  ),
  (
    700402, @client_id, @svc_order_id, 700201, 700303,
    '2026-03-10 11:31:10', 'outbound_shipped', 'ORDER', 1, 0,
    @order_unit_krw, ROUND(1 * @order_unit_krw, 4), 'KRW', '오더 처리 과금 이벤트', NOW(), NOW(), NULL
  )
ON DUPLICATE KEY UPDATE
  event_date=VALUES(event_date),
  basis_applied=VALUES(basis_applied),
  qty=VALUES(qty),
  box_count=VALUES(box_count),
  unit_price=VALUES(unit_price),
  amount=VALUES(amount),
  currency=VALUES(currency),
  remark=VALUES(remark),
  deleted_at=NULL,
  updated_at=NOW();

-- Packed outbound (예약 재고만 반영)
INSERT INTO outbound_orders (
  id, outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no,
  status, packed_at, shipped_at, created_by, created_at, updated_at, deleted_at
)
VALUES (
  700202, 'OUT-20260311-001', @client_id, @warehouse_id, '2026-03-11', 'NAVER', 'ORD-20260311-001', NULL,
  'packed', '2026-03-11 16:20:00', NULL, @manager_user_id, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  status=VALUES(status),
  sales_channel=VALUES(sales_channel),
  order_no=VALUES(order_no),
  packed_at=VALUES(packed_at),
  shipped_at=NULL,
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO outbound_items (
  id, outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at, deleted_at
)
VALUES (
  700212, 700202, @product_id, @lot_id, @loc_301_id, 30, 'PACK_BOX_AA', 3, '포장 완료, 출고 대기', NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  qty=VALUES(qty),
  box_type=VALUES(box_type),
  box_count=VALUES(box_count),
  remark=VALUES(remark),
  location_id=VALUES(location_id),
  deleted_at=NULL,
  updated_at=NOW();

-- Balance recompute (available=실제 트랜잭션, reserved=출고 대기)
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
  sb.reserved_qty = (
    SELECT COALESCE(SUM(oi.qty), 0)
    FROM outbound_orders oo
    JOIN outbound_items oi ON oi.outbound_order_id = oo.id
    WHERE oo.client_id=@client_id
      AND oo.warehouse_id=@warehouse_id
      AND oo.status IN ('allocated','picking','packed')
      AND oo.deleted_at IS NULL
      AND oi.product_id=@product_id
      AND oi.lot_id=@lot_id
      AND (oi.location_id <=> @loc_301_id)
      AND oi.deleted_at IS NULL
  ),
  sb.updated_at = NOW(),
  sb.deleted_at = NULL
WHERE sb.client_id=@client_id
  AND sb.product_id=@product_id
  AND sb.lot_id=@lot_id
  AND sb.warehouse_id=@warehouse_id
  AND (sb.location_id <=> @loc_301_id)
  AND sb.deleted_at IS NULL;

SET FOREIGN_KEY_CHECKS=1;
