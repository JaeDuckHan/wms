SET NAMES utf8mb4;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_10x;
CREATE TEMPORARY TABLE tmp_seed_10x (
  row_no INT PRIMARY KEY,
  client_code VARCHAR(50) NOT NULL,
  client_name_kr VARCHAR(255) NOT NULL,
  client_name_en VARCHAR(255) NOT NULL,
  contact_name VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  product_name_kr VARCHAR(255) NOT NULL,
  sku_code VARCHAR(100) NOT NULL,
  barcode_raw VARCHAR(120) NOT NULL,
  barcode_full VARCHAR(180) NOT NULL,
  lot_no VARCHAR(120) NOT NULL,
  location_code VARCHAR(100) NOT NULL,
  inbound_no VARCHAR(80) NOT NULL,
  outbound_no VARCHAR(80) NOT NULL,
  order_no VARCHAR(120) NOT NULL,
  tracking_no VARCHAR(120) NOT NULL,
  inbound_qty INT UNSIGNED NOT NULL,
  outbound_qty INT UNSIGNED NOT NULL
);

INSERT INTO tmp_seed_10x (
  row_no, client_code, client_name_kr, client_name_en, contact_name, phone, email, address,
  product_name_kr, sku_code, barcode_raw, barcode_full, lot_no, location_code,
  inbound_no, outbound_no, order_no, tracking_no, inbound_qty, outbound_qty
)
VALUES
  (1,  'CL301', 'Hanse Logistics Korea',      'Hanse Logistics Co., Ltd.',      'Jisoo Park',    '02-6010-1001', 'ops@hanse-logistics.co.kr',      'Gangseo-gu, Seoul, KR',     'Coway AP-1512HHS HEPA Filter',   'SKU-CL301-A1', '880123450301', '880123450301-TH', 'LOT-CL301-202602', 'A-01-01', 'IB-202603-301', 'OB-202603-301', 'NSM-20260302-30101', 'CJ6258012301KR', 180, 70),
  (2,  'CL302', 'BluePort Retail Korea',      'BluePort Retail Korea Ltd.',      'Minho Lee',     '02-6010-1002', 'logistics@blueportretail.com',   'Songpa-gu, Seoul, KR',      'LG HomeStar Kitchen Cleaner 500ml', 'SKU-CL302-K5', '880123450302', '880123450302-TH', 'LOT-CL302-202602', 'A-01-02', 'IB-202603-302', 'OB-202603-302', 'CPN-20260302-30211', 'HANJIN80114290302', 220, 90),
  (3,  'CL303', 'Daehan Mobility Parts',      'Daehan Mobility Parts Inc.',      'Yuna Choi',     '02-6010-1003', 'scm@daehanmobility.com',         'Guro-gu, Seoul, KR',        'Hyundai XTeer Engine Oil 5W30 1L', 'SKU-CL303-E2', '880123450303', '880123450303-TH', 'LOT-CL303-202602', 'A-01-03', 'IB-202603-303', 'OB-202603-303', 'SSG-20260302-30307', 'LOTTE74362003303', 200, 80),
  (4,  'CL304', 'Mirae Home Living',          'Mirae Home Living Co., Ltd.',     'Sora Kim',      '02-6010-1004', 'wh@miraehomeliving.com',         'Mapo-gu, Seoul, KR',        '3M Scotch-Brite Microfiber Mop Pad 2P', 'SKU-CL304-MP', '880123450304', '880123450304-TH', 'LOT-CL304-202602', 'A-01-04', 'IB-202603-304', 'OB-202603-304', 'KUR-20260302-30419', 'CJ6258012304KR', 240, 100),
  (5,  'CL305', 'Sejong Medical Supply',      'Sejong Medical Supply Corp.',     'Hyunwoo Jung',  '02-6010-1005', 'warehouse@sejongmedical.co.kr',  'Yongsan-gu, Seoul, KR',     'KleenGuard KF94 Mask 50 Pack',     'SKU-CL305-MS', '880123450305', '880123450305-TH', 'LOT-CL305-202602', 'A-01-05', 'IB-202603-305', 'OB-202603-305', 'AUC-20260302-30502', 'EPST90155300305', 300, 120),
  (6,  'CL306', 'Narae Beauty Labs',          'Narae Beauty Labs Ltd.',          'Eunji Han',     '02-6010-1006', 'ops@naraebeauty.com',            'Seongdong-gu, Seoul, KR',   'Round Lab 1025 Dokdo Toner 200ml',  'SKU-CL306-T2', '880123450306', '880123450306-TH', 'LOT-CL306-202602', 'A-01-06', 'IB-202603-306', 'OB-202603-306', 'MUS-20260302-30625', 'HANJIN80114290306', 260, 110),
  (7,  'CL307', 'Taeyang F&B Distribution',   'Taeyang F&B Distribution Co.',    'Doyun Seo',     '02-6010-1007', 'dc@taeyangfnb.com',              'Nowon-gu, Seoul, KR',       'Trevi Sparkling Water Lemon 330ml 24PK', 'SKU-CL307-SW', '880123450307', '880123450307-TH', 'LOT-CL307-202602', 'A-01-07', 'IB-202603-307', 'OB-202603-307', 'NAV-20260302-30704', 'LOTTE74362003307', 340, 150),
  (8,  'CL308', 'Winbridge Electronics',      'Winbridge Electronics Korea',      'Jiwon Kwon',    '02-6010-1008', 'fulfillment@winbridge.kr',       'Gangnam-gu, Seoul, KR',     'Anker PowerExpand USB-C Hub 7-in-1', 'SKU-CL308-U7', '880123450308', '880123450308-TH', 'LOT-CL308-202602', 'A-01-08', 'IB-202603-308', 'OB-202603-308', 'WGM-20260302-30810', 'CJ6258012308KR', 190, 85),
  (9,  'CL309', 'K-One Sports Gear',          'K-One Sports Gear Co., Ltd.',     'Taemin Shin',   '02-6010-1009', 'ops@konesportsgear.com',         'Incheon, KR',               'Nike Pro Compression Sleeve Pair',   'SKU-CL309-CS', '880123450309', '880123450309-TH', 'LOT-CL309-202602', 'A-01-09', 'IB-202603-309', 'OB-202603-309', 'C24-20260302-30918', 'EPST90155300309', 210, 95),
  (10, 'CL310', 'OceanBridge Trading',        'OceanBridge Trading Co., Ltd.',   'Hyejin Yoo',    '02-6010-1010', 'wms@oceanbridge-trading.com',    'Busan, KR',                 'Stanley Quencher Tumbler 20oz',       'SKU-CL310-IT', '880123450310', '880123450310-TH', 'LOT-CL310-202602', 'A-01-10', 'IB-202603-310', 'OB-202603-310', 'ABL-20260302-31006', 'HANJIN80114290310', 280, 130);

INSERT INTO clients (client_code, name_kr, name_en, contact_name, phone, email, address, status, created_at, updated_at, deleted_at)
SELECT
  s.client_code,
  s.client_name_kr,
  s.client_name_en,
  s.contact_name,
  s.phone,
  s.email,
  s.address,
  'active',
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
ON DUPLICATE KEY UPDATE
  name_kr = VALUES(name_kr),
  name_en = VALUES(name_en),
  contact_name = VALUES(contact_name),
  phone = VALUES(phone),
  email = VALUES(email),
  address = VALUES(address),
  status = 'active',
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO warehouses (code, name, country, timezone, status, created_at, updated_at, deleted_at)
VALUES ('WH-SEOUL-01', 'Seoul Integrated Fulfillment Center', 'KR', 'Asia/Seoul', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  country = VALUES(country),
  timezone = VALUES(timezone),
  status = 'active',
  deleted_at = NULL,
  updated_at = NOW();

SET @seed_warehouse_id := (
  SELECT id
  FROM warehouses
  WHERE code = 'WH-SEOUL-01' AND deleted_at IS NULL
  LIMIT 1
);

INSERT INTO warehouse_locations (warehouse_id, location_code, zone, status, created_at, updated_at, deleted_at)
SELECT
  @seed_warehouse_id,
  s.location_code,
  'A',
  'active',
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
ON DUPLICATE KEY UPDATE
  zone = VALUES(zone),
  status = 'active',
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO users (client_id, email, password_hash, name, role, status, created_at, updated_at, deleted_at)
VALUES
  (NULL, 'ops.admin@hanse-logistics.co.kr', '1234', 'Ops Admin', 'admin', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  status = 'active',
  deleted_at = NULL,
  updated_at = NOW();

SET @seed_user_id := (
  SELECT id
  FROM users
  WHERE email = 'ops.admin@hanse-logistics.co.kr' AND deleted_at IS NULL
  LIMIT 1
);

INSERT INTO products (client_id, sku_code, barcode_raw, barcode_full, name_kr, name_en, volume_ml, unit, status, created_at, updated_at, deleted_at)
SELECT
  c.id,
  s.sku_code,
  s.barcode_raw,
  s.barcode_full,
  s.product_name_kr,
  s.product_name_kr,
  500,
  'EA',
  'active',
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN clients c
  ON c.client_code = s.client_code
  AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  sku_code = VALUES(sku_code),
  name_kr = VALUES(name_kr),
  name_en = VALUES(name_en),
  volume_ml = VALUES(volume_ml),
  unit = VALUES(unit),
  status = 'active',
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO product_lots (product_id, lot_no, expiry_date, mfg_date, status, created_at, updated_at, deleted_at)
SELECT
  p.id,
  s.lot_no,
  DATE('2027-12-31'),
  DATE('2026-02-01'),
  'active',
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN products p
  ON p.barcode_full = s.barcode_full
  AND p.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  expiry_date = VALUES(expiry_date),
  mfg_date = VALUES(mfg_date),
  status = 'active',
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO inbound_orders (
  inbound_no, client_id, warehouse_id, inbound_date, status, memo, created_by, received_at, created_at, updated_at, deleted_at
)
SELECT
  s.inbound_no,
  c.id,
  @seed_warehouse_id,
  DATE('2026-03-01'),
  'received',
  CONCAT('Sample inbound load for ', s.client_name_en),
  @seed_user_id,
  TIMESTAMP('2026-03-01 10:00:00'),
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN clients c
  ON c.client_code = s.client_code
  AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  memo = VALUES(memo),
  received_at = VALUES(received_at),
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO inbound_items (
  inbound_order_id, product_id, lot_id, location_id, qty, invoice_price, currency, remark, created_at, updated_at, deleted_at
)
SELECT
  io.id,
  p.id,
  pl.id,
  wl.id,
  s.inbound_qty,
  18.5000,
  'THB',
  'Initial stock receiving sample',
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN inbound_orders io
  ON io.inbound_no = s.inbound_no
  AND io.deleted_at IS NULL
JOIN products p
  ON p.barcode_full = s.barcode_full
  AND p.deleted_at IS NULL
JOIN product_lots pl
  ON pl.product_id = p.id
  AND pl.lot_no = s.lot_no
  AND pl.deleted_at IS NULL
JOIN warehouse_locations wl
  ON wl.warehouse_id = @seed_warehouse_id
  AND wl.location_code = s.location_code
  AND wl.deleted_at IS NULL
LEFT JOIN inbound_items ii
  ON ii.inbound_order_id = io.id
  AND ii.product_id = p.id
  AND ii.lot_id = pl.id
  AND ii.deleted_at IS NULL
WHERE ii.id IS NULL;

INSERT INTO stock_transactions (
  client_id, product_id, lot_id, warehouse_id, location_id, from_location_id, to_location_id,
  txn_type, txn_date, qty_in, qty_out, ref_type, ref_id, note, created_by, created_at, updated_at, deleted_at
)
SELECT
  c.id,
  p.id,
  pl.id,
  @seed_warehouse_id,
  wl.id,
  NULL,
  NULL,
  'inbound_receive',
  TIMESTAMP('2026-03-01 10:30:00'),
  s.inbound_qty,
  0,
  'inbound_item',
  ii.id,
  CONCAT('Inbound sample for ', s.client_code),
  @seed_user_id,
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN clients c
  ON c.client_code = s.client_code
  AND c.deleted_at IS NULL
JOIN products p
  ON p.client_id = c.id
  AND p.barcode_full = s.barcode_full
  AND p.deleted_at IS NULL
JOIN product_lots pl
  ON pl.product_id = p.id
  AND pl.lot_no = s.lot_no
  AND pl.deleted_at IS NULL
JOIN inbound_orders io
  ON io.inbound_no = s.inbound_no
  AND io.deleted_at IS NULL
JOIN inbound_items ii
  ON ii.inbound_order_id = io.id
  AND ii.product_id = p.id
  AND ii.lot_id = pl.id
  AND ii.deleted_at IS NULL
JOIN warehouse_locations wl
  ON wl.warehouse_id = @seed_warehouse_id
  AND wl.location_code = s.location_code
  AND wl.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  qty_in = VALUES(qty_in),
  qty_out = VALUES(qty_out),
  note = VALUES(note),
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO outbound_orders (
  outbound_no, client_id, warehouse_id, order_date, sales_channel, order_no, tracking_no, status,
  packed_at, shipped_at, created_by, created_at, updated_at, deleted_at
)
SELECT
  s.outbound_no,
  c.id,
  @seed_warehouse_id,
  DATE('2026-03-02'),
  'Naver SmartStore',
  s.order_no,
  s.tracking_no,
  'shipped',
  TIMESTAMP('2026-03-02 14:20:00'),
  TIMESTAMP('2026-03-02 15:00:00'),
  @seed_user_id,
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN clients c
  ON c.client_code = s.client_code
  AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  sales_channel = VALUES(sales_channel),
  order_no = VALUES(order_no),
  tracking_no = VALUES(tracking_no),
  packed_at = VALUES(packed_at),
  shipped_at = VALUES(shipped_at),
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO outbound_items (
  outbound_order_id, product_id, lot_id, location_id, qty, box_type, box_count, remark, created_at, updated_at, deleted_at
)
SELECT
  oo.id,
  p.id,
  pl.id,
  wl.id,
  s.outbound_qty,
  'corrugated_small',
  CASE
    WHEN s.outbound_qty >= 120 THEN 6
    WHEN s.outbound_qty >= 100 THEN 5
    WHEN s.outbound_qty >= 90 THEN 4
    ELSE 3
  END,
  'Outbound sample shipment',
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN outbound_orders oo
  ON oo.outbound_no = s.outbound_no
  AND oo.deleted_at IS NULL
JOIN clients c
  ON c.id = oo.client_id
  AND c.deleted_at IS NULL
JOIN products p
  ON p.client_id = c.id
  AND p.barcode_full = s.barcode_full
  AND p.deleted_at IS NULL
JOIN product_lots pl
  ON pl.product_id = p.id
  AND pl.lot_no = s.lot_no
  AND pl.deleted_at IS NULL
JOIN warehouse_locations wl
  ON wl.warehouse_id = @seed_warehouse_id
  AND wl.location_code = s.location_code
  AND wl.deleted_at IS NULL
LEFT JOIN outbound_items oi
  ON oi.outbound_order_id = oo.id
  AND oi.product_id = p.id
  AND oi.lot_id = pl.id
  AND oi.deleted_at IS NULL
WHERE oi.id IS NULL;

INSERT INTO stock_transactions (
  client_id, product_id, lot_id, warehouse_id, location_id, from_location_id, to_location_id,
  txn_type, txn_date, qty_in, qty_out, ref_type, ref_id, note, created_by, created_at, updated_at, deleted_at
)
SELECT
  c.id,
  p.id,
  pl.id,
  @seed_warehouse_id,
  wl.id,
  wl.id,
  NULL,
  'outbound_ship',
  TIMESTAMP('2026-03-02 15:10:00'),
  0,
  s.outbound_qty,
  'outbound_item',
  oi.id,
  CONCAT('Outbound sample for ', s.client_code),
  @seed_user_id,
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN clients c
  ON c.client_code = s.client_code
  AND c.deleted_at IS NULL
JOIN products p
  ON p.client_id = c.id
  AND p.barcode_full = s.barcode_full
  AND p.deleted_at IS NULL
JOIN product_lots pl
  ON pl.product_id = p.id
  AND pl.lot_no = s.lot_no
  AND pl.deleted_at IS NULL
JOIN outbound_orders oo
  ON oo.outbound_no = s.outbound_no
  AND oo.deleted_at IS NULL
JOIN outbound_items oi
  ON oi.outbound_order_id = oo.id
  AND oi.product_id = p.id
  AND oi.lot_id = pl.id
  AND oi.deleted_at IS NULL
JOIN warehouse_locations wl
  ON wl.warehouse_id = @seed_warehouse_id
  AND wl.location_code = s.location_code
  AND wl.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  qty_in = VALUES(qty_in),
  qty_out = VALUES(qty_out),
  note = VALUES(note),
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO stock_balances (
  client_id, product_id, lot_id, warehouse_id, location_id, available_qty, reserved_qty, created_at, updated_at, deleted_at
)
SELECT
  c.id,
  p.id,
  pl.id,
  @seed_warehouse_id,
  wl.id,
  CAST(s.inbound_qty AS SIGNED) - CAST(s.outbound_qty AS SIGNED),
  0,
  NOW(),
  NOW(),
  NULL
FROM tmp_seed_10x s
JOIN clients c
  ON c.client_code = s.client_code
  AND c.deleted_at IS NULL
JOIN products p
  ON p.client_id = c.id
  AND p.barcode_full = s.barcode_full
  AND p.deleted_at IS NULL
JOIN product_lots pl
  ON pl.product_id = p.id
  AND pl.lot_no = s.lot_no
  AND pl.deleted_at IS NULL
JOIN warehouse_locations wl
  ON wl.warehouse_id = @seed_warehouse_id
  AND wl.location_code = s.location_code
  AND wl.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  available_qty = VALUES(available_qty),
  reserved_qty = VALUES(reserved_qty),
  deleted_at = NULL,
  updated_at = NOW();

DROP TEMPORARY TABLE IF EXISTS tmp_seed_10x;

COMMIT;
