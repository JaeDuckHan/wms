SET NAMES utf8mb4;

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
