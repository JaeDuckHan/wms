SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- products: dimensions, cbm, minimum monthly fee
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'width_cm') = 0,
  'ALTER TABLE products ADD COLUMN width_cm DECIMAL(10,2) NULL AFTER volume_ml',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'length_cm') = 0,
  'ALTER TABLE products ADD COLUMN length_cm DECIMAL(10,2) NULL AFTER width_cm',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'height_cm') = 0,
  'ALTER TABLE products ADD COLUMN height_cm DECIMAL(10,2) NULL AFTER length_cm',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'cbm_m3') = 0,
  'ALTER TABLE products ADD COLUMN cbm_m3 DECIMAL(18,6) NULL AFTER height_cm',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'min_storage_fee_month') = 0,
  'ALTER TABLE products ADD COLUMN min_storage_fee_month DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER cbm_m3',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill cbm_m3 from dimensions first, then from volume_ml fallback.
UPDATE products
SET cbm_m3 = ROUND((width_cm * length_cm * height_cm) / 1000000, 6)
WHERE (cbm_m3 IS NULL OR cbm_m3 <= 0)
  AND width_cm IS NOT NULL AND width_cm > 0
  AND length_cm IS NOT NULL AND length_cm > 0
  AND height_cm IS NOT NULL AND height_cm > 0;

UPDATE products
SET cbm_m3 = ROUND(volume_ml / 1000000, 6)
WHERE (cbm_m3 IS NULL OR cbm_m3 <= 0)
  AND volume_ml IS NOT NULL AND volume_ml > 0;

-- storage rate settings (warehouse+client > warehouse > client > global)
CREATE TABLE IF NOT EXISTS storage_rate_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  warehouse_id BIGINT UNSIGNED NULL,
  client_id BIGINT UNSIGNED NULL,
  rate_cbm DECIMAL(18,4) NOT NULL DEFAULT 0,
  rate_pallet DECIMAL(18,4) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'THB',
  effective_from DATE NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_srs_scope_effective (warehouse_id, client_id, effective_from, status, deleted_at),
  KEY idx_srs_effective_status (effective_from, status, deleted_at),
  CONSTRAINT fk_srs_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_srs_client FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'storage_rate_settings' AND index_name = 'idx_srs_scope_effective') = 0,
  'ALTER TABLE storage_rate_settings ADD KEY idx_srs_scope_effective (warehouse_id, client_id, effective_from, status, deleted_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'storage_rate_settings' AND index_name = 'idx_srs_effective_status') = 0,
  'ALTER TABLE storage_rate_settings ADD KEY idx_srs_effective_status (effective_from, status, deleted_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'storage_rate_settings'
     AND constraint_name = 'fk_srs_warehouse') = 0,
  'ALTER TABLE storage_rate_settings ADD CONSTRAINT fk_srs_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'storage_rate_settings'
     AND constraint_name = 'fk_srs_client') = 0,
  'ALTER TABLE storage_rate_settings ADD CONSTRAINT fk_srs_client FOREIGN KEY (client_id) REFERENCES clients(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
