SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Billing sample seed for local/dev verification

SET @seed_today := CURDATE();
SET @seed_month_start := DATE_SUB(@seed_today, INTERVAL DAY(@seed_today) - 1 DAY);
SET @seed_month := DATE_FORMAT(@seed_month_start, '%Y-%m');
SET @seed_rate_date := DATE_ADD(@seed_month_start, INTERVAL 19 DAY);
SET @seed_event_ship_date := DATE_ADD(@seed_month_start, INTERVAL 2 DAY);
SET @seed_event_box_date := DATE_ADD(@seed_month_start, INTERVAL 6 DAY);

INSERT INTO service_catalog
  (service_code, service_name_kr, billing_basis, default_currency, status)
VALUES
  ('TH_SHIPPING', 'Thailand Shipping', 'ORDER', 'THB', 'active'),
  ('TH_BOX', 'Thailand Box', 'BOX', 'THB', 'active'),
  ('OUTBOUND_FEE', 'Outbound Fee', 'ORDER', 'KRW', 'active')
ON DUPLICATE KEY UPDATE
  service_name_kr = VALUES(service_name_kr),
  billing_basis = VALUES(billing_basis),
  default_currency = VALUES(default_currency),
  status = VALUES(status),
  deleted_at = NULL;

INSERT INTO exchange_rates
  (rate_date, base_currency, quote_currency, rate, status, entered_by)
VALUES
  (@seed_rate_date, 'THB', 'KRW', 39.125000, 'active', 1)
ON DUPLICATE KEY UPDATE
  rate = VALUES(rate),
  status = VALUES(status),
  deleted_at = NULL;

SET @sample_client_id := (
  SELECT id
  FROM clients
  WHERE deleted_at IS NULL
  ORDER BY id ASC
  LIMIT 1
);

INSERT INTO billing_events
  (client_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw, status)
SELECT @sample_client_id, 'TH_SHIPPING', 'SHIPPING', CONCAT('SEED-SHP-', DATE_FORMAT(@seed_month_start, '%Y%m')), @seed_event_ship_date, 1, 'THB_BASED', 120, 120, NULL, NULL, 'PENDING'
WHERE @sample_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_events WHERE reference_id = CONCAT('SEED-SHP-', DATE_FORMAT(@seed_month_start, '%Y%m')) AND deleted_at IS NULL
  );

INSERT INTO billing_events
  (client_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw, status)
SELECT @sample_client_id, 'TH_BOX', 'SHIPPING', CONCAT('SEED-BOX-', DATE_FORMAT(@seed_month_start, '%Y%m')), @seed_event_box_date, 5, 'THB_BASED', 8, 40, NULL, NULL, 'PENDING'
WHERE @sample_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_events WHERE reference_id = CONCAT('SEED-BOX-', DATE_FORMAT(@seed_month_start, '%Y%m')) AND deleted_at IS NULL
  );

INSERT INTO billing_events
  (client_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw, status)
SELECT @sample_client_id, 'OUTBOUND_FEE', 'OUTBOUND', CONCAT('SEED-OUT-', DATE_FORMAT(@seed_month_start, '%Y%m')), @seed_event_box_date, 3, 'KRW_FIXED', NULL, NULL, 3500, 10500, 'PENDING'
WHERE @sample_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_events WHERE reference_id = CONCAT('SEED-OUT-', DATE_FORMAT(@seed_month_start, '%Y%m')) AND deleted_at IS NULL
  );

SET FOREIGN_KEY_CHECKS = 1;
