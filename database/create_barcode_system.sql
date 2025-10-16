-- Crear sistema de códigos de barras para productos
-- Tabla principal de productos con códigos de barras
CREATE TABLE IF NOT EXISTS product_barcodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    internal_code VARCHAR(50),
    siigo_product_id VARCHAR(100),
    category VARCHAR(100),
    brand VARCHAR(100),
    description TEXT,
    unit_weight DECIMAL(8,3),
    standard_price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    INDEX idx_barcode (barcode),
    INDEX idx_product_name (product_name),
    INDEX idx_siigo_product (siigo_product_id),
    INDEX idx_internal_code (internal_code)
);

-- Tabla de variantes de productos (sabores, tamaños, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_barcode_id INT NOT NULL,
    variant_name VARCHAR(255) NOT NULL,
    variant_value VARCHAR(255) NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    additional_info JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_barcode_id) REFERENCES product_barcodes(id) ON DELETE CASCADE,
    INDEX idx_variant_barcode (barcode),
    INDEX idx_variant_name (variant_name)
);

-- Tabla de mapeo entre productos SIIGO y códigos de barras
CREATE TABLE IF NOT EXISTS siigo_barcode_mapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    siigo_product_name VARCHAR(255) NOT NULL,
    siigo_product_code VARCHAR(100),
    barcode_id INT NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 1.00,
    mapping_type ENUM('exact', 'fuzzy', 'manual') DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (barcode_id) REFERENCES product_barcodes(id) ON DELETE CASCADE,
    INDEX idx_siigo_name (siigo_product_name),
    INDEX idx_siigo_code (siigo_product_code)
);

-- Insertar productos de ejemplo basados en lo que hemos visto en el sistema
INSERT INTO product_barcodes (product_name, barcode, internal_code, category, description, unit_weight, is_active) VALUES
('LIQUIPOPS SABOR A MARACUYA X 1200 GRO', '7701234567890', 'LIQ-MAR-1200', 'Dulces', 'Liquipops sabor maracuyá presentación 1200 gramos', 1.200, TRUE),
('CHUPETAS FRESA', '7701234567891', 'CHU-FRE-100', 'Dulces', 'Chupetas sabor fresa', 0.100, TRUE),
('PALETAS CHOCOLATE', '7701234567892', 'PAL-CHO-50', 'Dulces', 'Paletas de chocolate', 0.050, TRUE),
('GOMITAS MIXED', '7701234567893', 'GOM-MIX-200', 'Dulces', 'Gomitas sabores mixtos', 0.200, TRUE),
('COLOMBINAS DULCES', '7701234567894', 'COL-DUL-150', 'Dulces', 'Colombinas dulces surtidas', 0.150, TRUE),
('BOMBONES CHOCOLATE', '7701234567895', 'BOM-CHO-80', 'Dulces', 'Bombones de chocolate', 0.080, TRUE);

-- Insertar variantes para productos con diferentes sabores
INSERT INTO product_variants (product_barcode_id, variant_name, variant_value, barcode) VALUES
(1, 'sabor', 'maracuya', '7701234567890'),
(1, 'sabor', 'fresa', '7701234567896'),
(1, 'sabor', 'mango', '7701234567897'),
(2, 'sabor', 'fresa', '7701234567891'),
(2, 'sabor', 'mora', '7701234567898'),
(3, 'tipo', 'chocolate', '7701234567892'),
(3, 'tipo', 'vainilla', '7701234567899');

-- Crear mapeo inicial con productos comunes de SIIGO
INSERT INTO siigo_barcode_mapping (siigo_product_name, barcode_id, mapping_type, confidence_score) VALUES
('LIQUIPOPS SABOR A MARACUYA X 1200 GRO', 1, 'exact', 1.00),
('Liquipops Maracuya 1200g', 1, 'fuzzy', 0.95),
('CHUPETAS FRESA', 2, 'exact', 1.00),
('Chupetas Sabor Fresa', 2, 'fuzzy', 0.90),
('PALETAS CHOCOLATE', 3, 'exact', 1.00),
('Paletas de Chocolate', 3, 'fuzzy', 0.90),
('GOMITAS MIXED', 4, 'exact', 1.00),
('Gomitas Mixtas', 4, 'fuzzy', 0.85),
('COLOMBINAS DULCES', 5, 'exact', 1.00),
('BOMBONES CHOCOLATE', 6, 'exact', 1.00);

-- Agregar columna a order_items para referencia de código de barras
ALTER TABLE order_items 
ADD COLUMN barcode_id INT NULL AFTER product_code,
ADD INDEX idx_barcode_id (barcode_id);

-- Crear tabla de logs para seguimiento de escaneos
CREATE TABLE IF NOT EXISTS barcode_scan_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    barcode VARCHAR(100) NOT NULL,
    product_found BOOLEAN DEFAULT FALSE,
    product_barcode_id INT NULL,
    scan_result ENUM('success', 'not_found', 'already_verified', 'error') NOT NULL,
    user_id INT NOT NULL,
    scan_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_barcode_id) REFERENCES product_barcodes(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_order_scan (order_id),
    INDEX idx_barcode_scan (barcode),
    INDEX idx_scan_date (scan_timestamp)
);
