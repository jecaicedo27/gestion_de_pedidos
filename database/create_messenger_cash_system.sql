-- Sistema de Cierre de Caja para Mensajeros
-- Fecha: 2025-08-08
-- Descripción: Tablas para el control de efectivo y cierre de caja diario de mensajeros

-- Tabla para el registro de cierres de caja diarios
CREATE TABLE IF NOT EXISTS messenger_cash_closings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    messenger_id INT NOT NULL,
    closing_date DATE NOT NULL,
    expected_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Monto esperado según pedidos',
    declared_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Monto declarado por el mensajero',
    difference_amount DECIMAL(10, 2) GENERATED ALWAYS AS (declared_amount - expected_amount) STORED,
    status ENUM('pending', 'partial', 'completed', 'discrepancy') DEFAULT 'pending',
    notes TEXT,
    approved_by INT DEFAULT NULL COMMENT 'Usuario que aprobó el cierre',
    approved_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_messenger_date (messenger_id, closing_date),
    FOREIGN KEY (messenger_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_closing_date (closing_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para el detalle de pedidos en cada cierre de caja
CREATE TABLE IF NOT EXISTS cash_closing_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closing_id INT NOT NULL,
    order_id INT NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    payment_method ENUM('cash', 'transfer', 'card', 'other') NOT NULL,
    order_amount DECIMAL(10, 2) NOT NULL,
    collected_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    collection_status ENUM('pending', 'collected', 'partial', 'not_collected') DEFAULT 'pending',
    collection_notes TEXT,
    collected_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (closing_id) REFERENCES messenger_cash_closings(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (order_id),
    INDEX idx_collection_status (collection_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para evidencias de entrega (fotos, firmas, GPS)
CREATE TABLE IF NOT EXISTS delivery_evidence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    messenger_id INT NOT NULL,
    evidence_type ENUM('photo', 'signature', 'gps', 'note') NOT NULL,
    file_path VARCHAR(500) DEFAULT NULL COMMENT 'Ruta del archivo para fotos/firmas',
    gps_latitude DECIMAL(10, 8) DEFAULT NULL,
    gps_longitude DECIMAL(11, 8) DEFAULT NULL,
    gps_accuracy DECIMAL(5, 2) DEFAULT NULL COMMENT 'Precisión en metros',
    text_content TEXT DEFAULT NULL COMMENT 'Para notas de texto',
    captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (messenger_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_order_evidence (order_id),
    INDEX idx_messenger (messenger_id),
    INDEX idx_type (evidence_type),
    INDEX idx_captured_at (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para histórico de entregas de efectivo a caja principal
CREATE TABLE IF NOT EXISTS cash_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    messenger_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    delivered_to INT NOT NULL COMMENT 'Usuario que recibió el efectivo',
    delivery_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_number VARCHAR(50) DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (messenger_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (delivered_to) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_messenger_deliveries (messenger_id),
    INDEX idx_delivery_date (delivery_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vista para resumen de efectivo pendiente por mensajero
CREATE OR REPLACE VIEW messenger_cash_summary AS
SELECT 
    u.id AS messenger_id,
    u.full_name AS messenger_name,
    COALESCE(SUM(CASE 
        WHEN mcc.status IN ('pending', 'partial', 'discrepancy') 
        THEN mcc.expected_amount - COALESCE(cd.total_delivered, 0)
        ELSE 0 
    END), 0) AS pending_cash,
    COUNT(DISTINCT CASE 
        WHEN mcc.status IN ('pending', 'partial') 
        THEN mcc.closing_date 
    END) AS pending_closing_days,
    MAX(mcc.closing_date) AS last_closing_date
FROM users u
LEFT JOIN messenger_cash_closings mcc ON u.id = mcc.messenger_id
LEFT JOIN (
    SELECT 
        messenger_id,
        SUM(amount) AS total_delivered
    FROM cash_deliveries
    GROUP BY messenger_id
) cd ON u.id = cd.messenger_id
WHERE u.role = 'mensajero'
GROUP BY u.id, u.full_name;

-- Agregar columna para tracking de efectivo en pedidos
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS cash_collected BOOLEAN DEFAULT FALSE COMMENT 'Indica si se recolectó el efectivo',
ADD COLUMN IF NOT EXISTS cash_collected_at TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cash_collected_by INT DEFAULT NULL,
ADD INDEX idx_cash_collected (cash_collected),
ADD FOREIGN KEY (cash_collected_by) REFERENCES users(id) ON DELETE SET NULL;
