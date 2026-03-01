SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- Phase1 integrated seed (step 4/5)
-- 목적: 서비스 이벤트 기반 정산 + 인보이스까지 완성

SET @client_id := (SELECT id FROM clients WHERE client_code='C101' AND deleted_at IS NULL LIMIT 1);
SET @admin_user_id := (SELECT id FROM users WHERE email='admin@example.com' AND deleted_at IS NULL LIMIT 1);
SET @manager_email := (SELECT email FROM users WHERE email='manager101@example.com' AND deleted_at IS NULL LIMIT 1);
SET @svc_box_id := (SELECT id FROM service_catalog WHERE service_code='SV_OUTBOUND_BOX' AND deleted_at IS NULL LIMIT 1);
SET @svc_order_id := (SELECT id FROM service_catalog WHERE service_code='SV_OUTBOUND_ORDER' AND deleted_at IS NULL LIMIT 1);

-- FX rate (3월 정산 기준)
INSERT INTO exchange_rates (
  id, base_currency, quote_currency, rate, rate_date, status, entered_by, activated_by, activated_at, created_at, updated_at, deleted_at
)
VALUES (
  700701, 'THB', 'KRW', 39.250000, '2026-03-31', 'active', @admin_user_id, @admin_user_id, NOW(), NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  rate=VALUES(rate),
  status='active',
  activated_by=VALUES(activated_by),
  activated_at=VALUES(activated_at),
  deleted_at=NULL,
  updated_at=NOW();

-- Settlement batch
INSERT INTO settlement_batches (
  id, client_id, billing_month, exchange_rate_id, status, is_provisional,
  krw_subtotal, thb_subtotal, total_krw,
  closed_at, closed_by, created_by, created_at, updated_at, deleted_at
)
VALUES (
  700501, @client_id, '2026-03', 700701, 'reviewed', 1,
  0, 0, 0,
  NULL, NULL, @admin_user_id, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  exchange_rate_id=VALUES(exchange_rate_id),
  status='reviewed',
  is_provisional=1,
  deleted_at=NULL,
  updated_at=NOW();

-- Settlement lines (서비스 2건 + 수기비용 1건)
INSERT INTO settlement_lines (
  id, settlement_batch_id, service_id, line_type, description, basis,
  qty, unit_price, currency, amount, extra_amount, total_amount,
  source_service_event_id, created_at, updated_at, deleted_at
)
VALUES
  (
    700511, 700501, @svc_box_id, 'service', '출고 박스비 (OUT-20260310-001)', 'BOX',
    7, 700.0000, 'KRW', 4900.0000, 0, 4900.0000,
    700401, NOW(), NOW(), NULL
  ),
  (
    700512, 700501, @svc_order_id, 'service', '출고 처리비 (OUT-20260310-001)', 'ORDER',
    1, 3500.0000, 'KRW', 3500.0000, 0, 3500.0000,
    700402, NOW(), NOW(), NULL
  ),
  (
    700513, 700501, NULL, 'manual_expense', '포장부자재 비용', 'MANUAL',
    1, 1200.0000, 'KRW', 1200.0000, 0, 1200.0000,
    NULL, NOW(), NOW(), NULL
  )
ON DUPLICATE KEY UPDATE
  service_id=VALUES(service_id),
  line_type=VALUES(line_type),
  description=VALUES(description),
  basis=VALUES(basis),
  qty=VALUES(qty),
  unit_price=VALUES(unit_price),
  currency=VALUES(currency),
  amount=VALUES(amount),
  extra_amount=VALUES(extra_amount),
  total_amount=VALUES(total_amount),
  source_service_event_id=VALUES(source_service_event_id),
  deleted_at=NULL,
  updated_at=NOW();

-- Batch totals 계산 후 close 상태로 확정
UPDATE settlement_batches sb
SET
  sb.krw_subtotal = (
    SELECT COALESCE(SUM(sl.total_amount), 0)
    FROM settlement_lines sl
    WHERE sl.settlement_batch_id = sb.id
      AND sl.currency='KRW'
      AND sl.deleted_at IS NULL
  ),
  sb.thb_subtotal = (
    SELECT COALESCE(SUM(sl.total_amount), 0)
    FROM settlement_lines sl
    WHERE sl.settlement_batch_id = sb.id
      AND sl.currency='THB'
      AND sl.deleted_at IS NULL
  ),
  sb.total_krw = (
    SELECT COALESCE(SUM(CASE WHEN sl.currency='KRW' THEN sl.total_amount ELSE 0 END), 0)
    FROM settlement_lines sl
    WHERE sl.settlement_batch_id = sb.id
      AND sl.deleted_at IS NULL
  ),
  sb.status = 'closed',
  sb.is_provisional = 0,
  sb.closed_at = NOW(),
  sb.closed_by = @admin_user_id,
  sb.updated_at = NOW(),
  sb.deleted_at = NULL
WHERE sb.id = 700501;

-- Invoice sequence + invoice
INSERT INTO invoice_sequences (client_id, yyyymm, last_seq, created_at, updated_at, deleted_at)
VALUES (@client_id, '202603', 1, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  last_seq = GREATEST(last_seq, 1),
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO invoices (
  id, settlement_batch_id, client_id, invoice_no, status,
  issue_date, due_date, recipient_email, currency, total_amount,
  sent_at, created_by, created_at, updated_at, deleted_at
)
VALUES (
  700601, 700501, @client_id, 'INV-202603-C101-001', 'sent',
  '2026-03-31', '2026-04-10', @manager_email, 'KRW',
  (SELECT total_krw FROM settlement_batches WHERE id=700501),
  NOW(), @admin_user_id, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
  invoice_no=VALUES(invoice_no),
  status='sent',
  issue_date=VALUES(issue_date),
  due_date=VALUES(due_date),
  recipient_email=VALUES(recipient_email),
  currency=VALUES(currency),
  total_amount=VALUES(total_amount),
  sent_at=VALUES(sent_at),
  deleted_at=NULL,
  updated_at=NOW();

INSERT INTO invoice_lines (
  id, invoice_id, settlement_line_id, service_id, line_type, description,
  qty, unit, currency, unit_price, amount, extra_amount, total_amount,
  created_at, updated_at, deleted_at
)
VALUES
  (700611, 700601, 700511, @svc_box_id, 'service', '출고 박스비', 7, 'BOX', 'KRW', 700.0000, 4900.0000, 0, 4900.0000, NOW(), NOW(), NULL),
  (700612, 700601, 700512, @svc_order_id, 'service', '출고 처리비', 1, 'ORDER', 'KRW', 3500.0000, 3500.0000, 0, 3500.0000, NOW(), NOW(), NULL),
  (700613, 700601, 700513, NULL, 'manual_expense', '포장부자재 비용', 1, 'MANUAL', 'KRW', 1200.0000, 1200.0000, 0, 1200.0000, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  settlement_line_id=VALUES(settlement_line_id),
  service_id=VALUES(service_id),
  line_type=VALUES(line_type),
  description=VALUES(description),
  qty=VALUES(qty),
  unit=VALUES(unit),
  currency=VALUES(currency),
  unit_price=VALUES(unit_price),
  amount=VALUES(amount),
  extra_amount=VALUES(extra_amount),
  total_amount=VALUES(total_amount),
  deleted_at=NULL,
  updated_at=NOW();

-- Invoice total 재계산
UPDATE invoices i
SET
  i.total_amount = (
    SELECT COALESCE(SUM(il.total_amount), 0)
    FROM invoice_lines il
    WHERE il.invoice_id=i.id
      AND il.deleted_at IS NULL
  ),
  i.updated_at = NOW(),
  i.deleted_at = NULL
WHERE i.id=700601;

SET FOREIGN_KEY_CHECKS=1;
