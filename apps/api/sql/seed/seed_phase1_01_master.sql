SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- Phase1 integrated seed (step 1/5)
-- 목적: 입고/출고/정산 연동 테스트를 위한 기준 마스터 데이터 보장

-- 1) Client
INSERT INTO clients (client_code, name_kr, status, created_at, updated_at, deleted_at)
VALUES ('C101', 'Client 101', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  name_kr=VALUES(name_kr),
  status='active',
  deleted_at=NULL,
  updated_at=NOW();

SET @client_id := (
  SELECT id FROM clients WHERE client_code='C101' AND deleted_at IS NULL LIMIT 1
);

-- 2) Warehouse
INSERT INTO warehouses (code, name, country, timezone, status, created_at, updated_at, deleted_at)
VALUES ('WH201', 'Warehouse 201', 'TH', 'Asia/Bangkok', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  name=VALUES(name),
  country=VALUES(country),
  timezone=VALUES(timezone),
  status='active',
  deleted_at=NULL,
  updated_at=NOW();

SET @warehouse_id := (
  SELECT id FROM warehouses WHERE code='WH201' AND deleted_at IS NULL LIMIT 1
);

-- 3) Locations (출고/이동 테스트를 위해 2개 확보)
INSERT INTO warehouse_locations (warehouse_id, location_code, zone, status, created_at, updated_at, deleted_at)
VALUES
  (@warehouse_id, 'LOC-301', 'Z1', 'active', NOW(), NOW(), NULL),
  (@warehouse_id, 'LOC-302', 'Z2', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  zone=VALUES(zone),
  status='active',
  deleted_at=NULL,
  updated_at=NOW();

SET @loc_301_id := (
  SELECT id FROM warehouse_locations
  WHERE warehouse_id=@warehouse_id AND location_code='LOC-301' AND deleted_at IS NULL
  LIMIT 1
);

-- 4) Users
INSERT INTO users (client_id, email, password_hash, name, role, status, created_at, updated_at, deleted_at)
VALUES
  (@client_id, 'manager101@example.com', 'x', 'Manager101', 'manager', 'active', NOW(), NOW(), NULL),
  (NULL, 'admin@example.com', 'x', 'Admin', 'admin', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  name=VALUES(name),
  role=VALUES(role),
  status='active',
  deleted_at=NULL,
  updated_at=NOW();

SET @manager_user_id := (
  SELECT id FROM users WHERE email='manager101@example.com' AND deleted_at IS NULL LIMIT 1
);
SET @admin_user_id := (
  SELECT id FROM users WHERE email='admin@example.com' AND deleted_at IS NULL LIMIT 1
);

-- 5) Product / Lot
INSERT INTO products (client_id, sku_code, barcode_raw, barcode_full, name_kr, status, created_at, updated_at, deleted_at)
VALUES (@client_id, 'SKU-401', 'RAW401', 'FULL401', 'Product 401', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  sku_code=VALUES(sku_code),
  name_kr=VALUES(name_kr),
  status='active',
  deleted_at=NULL,
  updated_at=NOW();

SET @product_id := (
  SELECT id FROM products WHERE client_id=@client_id AND barcode_full='FULL401' AND deleted_at IS NULL LIMIT 1
);

INSERT INTO product_lots (product_id, lot_no, expiry_date, status, created_at, updated_at, deleted_at)
VALUES (@product_id, 'LOT-501', '2027-12-31', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  expiry_date=VALUES(expiry_date),
  status='active',
  deleted_at=NULL,
  updated_at=NOW();

SET @lot_id := (
  SELECT id FROM product_lots WHERE product_id=@product_id AND lot_no='LOT-501' AND deleted_at IS NULL LIMIT 1
);

-- 6) Service catalog
INSERT INTO service_catalog (service_code, service_name_kr, billing_basis, default_currency, status, created_at, updated_at, deleted_at)
VALUES
  ('SV_OUTBOUND_BOX', '출고 박스비', 'BOX', 'KRW', 'active', NOW(), NOW(), NULL),
  ('SV_OUTBOUND_ORDER', '출고 처리비', 'ORDER', 'KRW', 'active', NOW(), NOW(), NULL),
  ('SV_MANUAL_EXPENSE', '수기 비용', 'MANUAL', 'KRW', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  service_name_kr=VALUES(service_name_kr),
  billing_basis=VALUES(billing_basis),
  default_currency=VALUES(default_currency),
  status='active',
  deleted_at=NULL,
  updated_at=NOW();

SET @svc_box_id := (SELECT id FROM service_catalog WHERE service_code='SV_OUTBOUND_BOX' AND deleted_at IS NULL LIMIT 1);
SET @svc_order_id := (SELECT id FROM service_catalog WHERE service_code='SV_OUTBOUND_ORDER' AND deleted_at IS NULL LIMIT 1);

-- 7) Price policies (정산 계산 기준)
INSERT INTO price_policies (
  client_id, service_id, unit_price, currency, effective_from, effective_to, status, created_at, updated_at, deleted_at
)
VALUES
  (@client_id, @svc_box_id, 700.0000, 'KRW', '2026-01-01', NULL, 'active', NOW(), NOW(), NULL),
  (@client_id, @svc_order_id, 3500.0000, 'KRW', '2026-01-01', NULL, 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  unit_price=VALUES(unit_price),
  currency=VALUES(currency),
  effective_to=NULL,
  status='active',
  deleted_at=NULL,
  updated_at=NOW();

SET FOREIGN_KEY_CHECKS=1;
