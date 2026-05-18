SET NAMES utf8mb4;

ALTER TABLE inbound_items
  MODIFY currency ENUM('KRW','THB','USD') NULL;

CREATE TABLE IF NOT EXISTS inbound_order_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inbound_order_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(40) NOT NULL,
  from_status VARCHAR(30) NULL,
  to_status VARCHAR(30) NULL,
  note VARCHAR(1000) NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inbound_order_logs_order_created (inbound_order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS outbound_order_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  outbound_order_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(40) NOT NULL,
  from_status VARCHAR(30) NULL,
  to_status VARCHAR(30) NULL,
  note VARCHAR(1000) NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_outbound_order_logs_order_created (outbound_order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS outbound_boxes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  outbound_order_id BIGINT UNSIGNED NOT NULL,
  box_no VARCHAR(80) NOT NULL,
  courier VARCHAR(100) NULL,
  tracking_no VARCHAR(120) NULL,
  item_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('open','packed','shipped') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_outbound_box_no (outbound_order_id, box_no),
  KEY idx_outbound_boxes_order_deleted (outbound_order_id, deleted_at),
  CONSTRAINT fk_outbound_boxes_order FOREIGN KEY (outbound_order_id) REFERENCES outbound_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS outbound_box_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  outbound_box_id BIGINT UNSIGNED NOT NULL,
  outbound_item_id BIGINT UNSIGNED NOT NULL,
  packed_qty INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_outbound_box_item (outbound_box_id, outbound_item_id),
  KEY idx_outbound_box_items_box_deleted (outbound_box_id, deleted_at),
  KEY idx_outbound_box_items_item_deleted (outbound_item_id, deleted_at),
  CONSTRAINT fk_outbound_box_items_box FOREIGN KEY (outbound_box_id) REFERENCES outbound_boxes(id),
  CONSTRAINT fk_outbound_box_items_item FOREIGN KEY (outbound_item_id) REFERENCES outbound_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_export_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  export_format VARCHAR(20) NOT NULL,
  requested_by BIGINT UNSIGNED NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_name VARCHAR(255) NULL,
  meta_json JSON NULL,
  PRIMARY KEY (id),
  KEY idx_invoice_export_logs_invoice_requested (invoice_id, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
