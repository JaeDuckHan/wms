SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- service_catalog extension (MySQL 5.7/8.x compatible)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'service_catalog' AND column_name = 'service_name') = 0,
  'ALTER TABLE service_catalog ADD COLUMN service_name VARCHAR(255) NULL AFTER service_name_kr',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'service_catalog' AND column_name = 'billing_unit') = 0,
  'ALTER TABLE service_catalog ADD COLUMN billing_unit ENUM(''ORDER'',''SKU'',''BOX'',''CBM'',''PALLET'',''EVENT'',''MONTH'') NULL AFTER billing_basis',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'service_catalog' AND column_name = 'pricing_policy') = 0,
  'ALTER TABLE service_catalog ADD COLUMN pricing_policy ENUM(''THB_BASED'',''KRW_FIXED'') NOT NULL DEFAULT ''KRW_FIXED'' AFTER billing_unit',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'service_catalog' AND column_name = 'default_rate') = 0,
  'ALTER TABLE service_catalog ADD COLUMN default_rate DECIMAL(18,4) NULL AFTER default_currency',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE service_catalog
SET service_name = COALESCE(service_name, service_name_kr)
WHERE service_name IS NULL;

UPDATE service_catalog
SET billing_unit = CASE billing_basis
  WHEN 'ORDER' THEN 'ORDER'
  WHEN 'BOX' THEN 'BOX'
  WHEN 'QTY' THEN 'SKU'
  ELSE 'EVENT'
END
WHERE billing_unit IS NULL;

UPDATE service_catalog
SET default_rate = 0
WHERE default_rate IS NULL;

-- exchange_rates extension
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'exchange_rates' AND column_name = 'source') = 0,
  'ALTER TABLE exchange_rates ADD COLUMN source ENUM(''manual'',''api'') NOT NULL DEFAULT ''manual'' AFTER rate',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'exchange_rates' AND column_name = 'locked') = 0,
  'ALTER TABLE exchange_rates ADD COLUMN locked TINYINT(1) NOT NULL DEFAULT 0 AFTER source',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- invoices extension
SET @sql := IF(
  (
    SELECT CASE
      WHEN COUNT(*) = 0 THEN 0
      WHEN MAX(IS_NULLABLE = 'NO') = 1 THEN 1
      ELSE 0
    END
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'settlement_batch_id'
  ) = 1,
  'ALTER TABLE invoices MODIFY settlement_batch_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'invoice_month') = 0,
  'ALTER TABLE invoices ADD COLUMN invoice_month CHAR(7) NULL AFTER client_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'invoice_date') = 0,
  'ALTER TABLE invoices ADD COLUMN invoice_date DATE NULL AFTER issue_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'fx_rate_thbkrw') = 0,
  'ALTER TABLE invoices ADD COLUMN fx_rate_thbkrw DECIMAL(18,6) NULL AFTER currency',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'subtotal_krw') = 0,
  'ALTER TABLE invoices ADD COLUMN subtotal_krw DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER fx_rate_thbkrw',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'vat_krw') = 0,
  'ALTER TABLE invoices ADD COLUMN vat_krw DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER subtotal_krw',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'total_krw') = 0,
  'ALTER TABLE invoices ADD COLUMN total_krw DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER vat_krw',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS client_contract_rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  service_code VARCHAR(80) NOT NULL,
  custom_rate DECIMAL(18,4) NOT NULL,
  currency ENUM('THB','KRW') NOT NULL,
  effective_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_contract_rate (client_id, service_code, effective_date),
  KEY idx_client_contract_client_deleted (client_id, deleted_at),
  KEY idx_client_contract_service_deleted (service_code, deleted_at),
  CONSTRAINT fk_client_contract_client FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS billing_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  service_code VARCHAR(80) NOT NULL,
  reference_type VARCHAR(40) NOT NULL,
  reference_id VARCHAR(120) NULL,
  event_date DATE NOT NULL,
  qty DECIMAL(18,4) NOT NULL DEFAULT 0,
  pricing_policy ENUM('THB_BASED','KRW_FIXED') NOT NULL,
  unit_price_thb DECIMAL(18,4) NULL,
  amount_thb DECIMAL(18,4) NULL,
  unit_price_krw DECIMAL(18,4) NULL,
  amount_krw DECIMAL(18,4) NULL,
  fx_rate_thbkrw DECIMAL(18,6) NULL,
  invoice_id BIGINT UNSIGNED NULL,
  status ENUM('PENDING','INVOICED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_billing_event_client_month (client_id, event_date, status, deleted_at),
  KEY idx_billing_event_invoice_deleted (invoice_id, deleted_at),
  CONSTRAINT fk_billing_event_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_billing_event_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  service_code VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL,
  qty DECIMAL(18,4) NOT NULL DEFAULT 0,
  unit_price_krw DECIMAL(18,4) NOT NULL DEFAULT 0,
  amount_krw DECIMAL(18,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_invoice_items_invoice_deleted (invoice_id, deleted_at),
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
