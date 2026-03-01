SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Billing sample seed for local/dev verification

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
  ('2026-02-20', 'THB', 'KRW', 39.125000, 'active', 1)
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
SELECT @sample_client_id, 'TH_SHIPPING', 'SHIPPING', 'SEED-SHP-001', '2026-02-03', 1, 'THB_BASED', 120, 120, NULL, NULL, 'PENDING'
WHERE @sample_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_events WHERE reference_id = 'SEED-SHP-001' AND deleted_at IS NULL
  );

INSERT INTO billing_events
  (client_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw, status)
SELECT @sample_client_id, 'TH_BOX', 'SHIPPING', 'SEED-BOX-001', '2026-02-07', 5, 'THB_BASED', 8, 40, NULL, NULL, 'PENDING'
WHERE @sample_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_events WHERE reference_id = 'SEED-BOX-001' AND deleted_at IS NULL
  );

INSERT INTO billing_events
  (client_id, service_code, reference_type, reference_id, event_date, qty, pricing_policy, unit_price_thb, amount_thb, unit_price_krw, amount_krw, status)
SELECT @sample_client_id, 'OUTBOUND_FEE', 'OUTBOUND', 'SEED-OUT-001', '2026-02-07', 3, 'KRW_FIXED', NULL, NULL, 3500, 10500, 'PENDING'
WHERE @sample_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_events WHERE reference_id = 'SEED-OUT-001' AND deleted_at IS NULL
  );

SET FOREIGN_KEY_CHECKS = 1;
