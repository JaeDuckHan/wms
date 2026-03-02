SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO tmp_seed_10x (
  row_no, client_code, client_name_kr, client_name_en, contact_name, phone, email, address,
  product_name_kr, sku_code, barcode_raw, barcode_full, lot_no, location_code,
  inbound_no, outbound_no, order_no, tracking_no, inbound_qty, outbound_qty
)
VALUES
  (1,  'CL301', '아모레퍼시픽',               'AMOREPACIFIC Corporation',         'Jisoo Park',    '02-6010-1001', 'ops@amorepacific-partner.co.kr', 'Gangseo-gu, Seoul, KR',     'Laneige Water Bank Blue Hyaluronic Cream 50ml', 'SKU-CL301-A1', '880123450301', '880123450301-TH', 'LOT-CL301-202602', 'A-01-01', 'IB-202603-301', 'OB-202603-301', 'NVR-20260302-AP301', 'CJ6258439101KR', 180, 70),
  (2,  'CL302', 'LG생활건강',                 'LG Household & Health Care',       'Minho Lee',     '02-6010-1002', 'logistics@lghnh-partner.co.kr',  'Songpa-gu, Seoul, KR',      'Dr.Jart+ Cicapair Tiger Grass Serum 50ml', 'SKU-CL302-K5', '880123450302', '880123450302-TH', 'LOT-CL302-202602', 'A-01-02', 'IB-202603-302', 'OB-202603-302', 'CPG-20260302-LG302', 'HJ71024589302KR', 220, 90),
  (3,  'CL303', '코스맥스',                   'COSMAX, Inc.',                      'Yuna Choi',     '02-6010-1003', 'scm@cosmax-partner.com',         'Guro-gu, Seoul, KR',        'Innisfree Green Tea Seed Hyaluronic Serum 80ml', 'SKU-CL303-E2', '880123450303', '880123450303-TH', 'LOT-CL303-202602', 'A-01-03', 'IB-202603-303', 'OB-202603-303', 'SSG-20260302-CM303', 'LT63289011303KR', 200, 80),
  (4,  'CL304', '한국콜마',                   'Kolmar Korea Co., Ltd.',           'Sora Kim',      '02-6010-1004', 'wh@kolmar-partner.co.kr',        'Mapo-gu, Seoul, KR',        'AESTURA Atobarrier 365 Cream 80ml', 'SKU-CL304-MP', '880123450304', '880123450304-TH', 'LOT-CL304-202602', 'A-01-04', 'IB-202603-304', 'OB-202603-304', 'KUR-20260302-KK304', 'CJ6258439104KR', 240, 100),
  (5,  'CL305', '클리오',                     'CLIO Co., Ltd.',                    'Hyunwoo Jung',  '02-6010-1005', 'warehouse@clio-partner.co.kr',   'Yongsan-gu, Seoul, KR',     'COSRX Advanced Snail 96 Mucin Essence 100ml', 'SKU-CL305-MS', '880123450305', '880123450305-TH', 'LOT-CL305-202602', 'A-01-05', 'IB-202603-305', 'OB-202603-305', 'AUC-20260302-CL305', 'EP55048277305KR', 300, 120),
  (6,  'CL306', '에이블씨엔씨',               'ABLE C&C Co., Ltd.',                'Eunji Han',     '02-6010-1006', 'ops@ablecnc-partner.com',        'Seongdong-gu, Seoul, KR',   'Round Lab 1025 Dokdo Toner 200ml', 'SKU-CL306-T2', '880123450306', '880123450306-TH', 'LOT-CL306-202602', 'A-01-06', 'IB-202603-306', 'OB-202603-306', 'MUS-20260302-AB306', 'HJ71024589306KR', 260, 110),
  (7,  'CL307', 'APR',                        'APR Co., Ltd.',                     'Doyun Seo',     '02-6010-1007', 'dc@apr-partner.com',             'Nowon-gu, Seoul, KR',       'VT Reedle Shot 100 Essence 50ml', 'SKU-CL307-SW', '880123450307', '880123450307-TH', 'LOT-CL307-202602', 'A-01-07', 'IB-202603-307', 'OB-202603-307', 'NAV-20260302-APR307', 'LT63289011307KR', 340, 150),
  (8,  'CL308', '애경산업',                   'Aekyung Industrial Co., Ltd.',      'Jiwon Kwon',    '02-6010-1008', 'fulfillment@aekyung-partner.kr', 'Gangnam-gu, Seoul, KR',     'Anua Heartleaf 77 Soothing Toner 250ml', 'SKU-CL308-U7', '880123450308', '880123450308-TH', 'LOT-CL308-202602', 'A-01-08', 'IB-202603-308', 'OB-202603-308', 'WGM-20260302-AK308', 'CJ6258439108KR', 190, 85),
  (9,  'CL309', '토니모리',                   'TONYMOLY Co., Ltd.',                'Taemin Shin',   '02-6010-1009', 'ops@tonymoly-partner.co.kr',     'Incheon, KR',               'TIRTIR Mask Fit Red Cushion 21N', 'SKU-CL309-CS', '880123450309', '880123450309-TH', 'LOT-CL309-202602', 'A-01-09', 'IB-202603-309', 'OB-202603-309', 'C24-20260302-TM309', 'EP55048277309KR', 210, 95),
  (10, 'CL310', '네이처리퍼블릭',             'Nature Republic Co., Ltd.',         'Hyejin Yoo',    '02-6010-1010', 'wms@naturerepublic-partner.co.kr','Busan, KR',                 'rom&nd Juicy Lasting Tint 06 Figfig', 'SKU-CL310-IT', '880123450310', '880123450310-TH', 'LOT-CL310-202602', 'A-01-10', 'IB-202603-310', 'OB-202603-310', 'ABL-20260302-NR310', 'HJ71024589310KR', 280, 130);

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
  (NULL, 'ops.admin@amorepacific-partner.co.kr', '1234', 'Ops Admin', 'admin', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  status = 'active',
  deleted_at = NULL,
  updated_at = NOW();

SET @seed_user_id := (
  SELECT id
  FROM users
  WHERE email = 'ops.admin@amorepacific-partner.co.kr' AND deleted_at IS NULL
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
