-- Tabla para trackear escaneos individuales de productos durante el empaque
CREATE TABLE IF NOT EXISTS barcode_scans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  item_id INT NOT NULL,
  product_code VARCHAR(100),
  barcode VARCHAR(100),
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scanned_by VARCHAR(100) DEFAULT 'barcode_scanner',
  scan_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_order_item (order_id, item_id),
  INDEX idx_barcode (barcode),
  INDEX idx_product_code (product_code),
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES order_items(id) ON DELETE CASCADE
);

-- Agregar campo de conteo de escaneos a la tabla de verificaciones
ALTER TABLE packaging_item_verifications 
ADD COLUMN scanned_count INT DEFAULT 0 AFTER packed_size,
ADD COLUMN required_scans INT DEFAULT 1 AFTER scanned_count;
