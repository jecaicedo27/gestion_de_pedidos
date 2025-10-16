-- Sistema de Mensajeros Locales
-- Tabla para gestionar mensajeros que realizan entregas locales y manejan cobros

-- 1. Tabla principal de mensajeros
CREATE TABLE IF NOT EXISTS messengers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    identification VARCHAR(50) UNIQUE,
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    transportation_type ENUM('moto', 'bicicleta', 'carro', 'pie') DEFAULT 'moto',
    delivery_zones TEXT, -- JSON con zonas que cubre
    is_active BOOLEAN DEFAULT true,
    can_collect_payments BOOLEAN DEFAULT true, -- Si puede recibir pagos
    commission_percentage DECIMAL(5,2) DEFAULT 0.00, -- Comisión por entrega
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 2. Tabla de entregas asignadas a mensajeros
CREATE TABLE IF NOT EXISTS messenger_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    messenger_id INT NOT NULL,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pickup_address TEXT, -- Dirección de recogida
    delivery_address TEXT, -- Dirección de entrega
    estimated_delivery_time DATETIME,
    actual_delivery_time DATETIME,
    status ENUM('asignado', 'en_ruta', 'entregado', 'fallido', 'devuelto') DEFAULT 'asignado',
    payment_collected DECIMAL(10,2) DEFAULT 0.00, -- Dinero cobrado
    payment_method_used VARCHAR(100), -- Efectivo, transferencia, etc.
    delivery_notes TEXT,
    customer_signature TEXT, -- Base64 de firma si aplica
    delivery_photo TEXT, -- URL o base64 de foto de entrega
    commission_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    assigned_by INT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (messenger_id) REFERENCES messengers(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- 3. Tabla de rendimiento y métricas de mensajeros
CREATE TABLE IF NOT EXISTS messenger_performance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    messenger_id INT NOT NULL,
    date DATE NOT NULL,
    total_deliveries INT DEFAULT 0,
    successful_deliveries INT DEFAULT 0,
    failed_deliveries INT DEFAULT 0,
    total_collected DECIMAL(10,2) DEFAULT 0.00,
    total_commission DECIMAL(10,2) DEFAULT 0.00,
    average_delivery_time INT DEFAULT 0, -- en minutos
    rating DECIMAL(3,2) DEFAULT 0.00, -- calificación promedio
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (messenger_id) REFERENCES messengers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_messenger_date (messenger_id, date)
);

-- 4. Tabla de zonas de entrega
CREATE TABLE IF NOT EXISTS delivery_zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    coverage_area TEXT, -- JSON con coordenadas o descripción
    base_delivery_cost DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Relación mensajeros-zonas (un mensajero puede cubrir múltiples zonas)
CREATE TABLE IF NOT EXISTS messenger_zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    messenger_id INT NOT NULL,
    zone_id INT NOT NULL,
    is_preferred BOOLEAN DEFAULT false, -- Si es zona preferida del mensajero
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (messenger_id) REFERENCES messengers(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES delivery_zones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_messenger_zone (messenger_id, zone_id)
);

-- 6. Insertar zonas por defecto
INSERT INTO delivery_zones (name, description, base_delivery_cost) VALUES
('Centro', 'Centro de la ciudad', 5000.00),
('Norte', 'Zona norte de la ciudad', 7000.00),
('Sur', 'Zona sur de la ciudad', 7000.00),
('Oriente', 'Zona oriental', 8000.00),
('Occidente', 'Zona occidental', 8000.00),
('Área Metropolitana', 'Municipios cercanos', 15000.00);

-- 7. Crear índices para optimizar consultas
CREATE INDEX idx_messengers_active ON messengers(is_active);
CREATE INDEX idx_messengers_phone ON messengers(phone);
CREATE INDEX idx_messenger_deliveries_status ON messenger_deliveries(status);
CREATE INDEX idx_messenger_deliveries_date ON messenger_deliveries(assigned_date);
CREATE INDEX idx_messenger_deliveries_messenger ON messenger_deliveries(messenger_id);
CREATE INDEX idx_messenger_performance_date ON messenger_performance(date);

-- 8. Actualizar tabla orders para incluir mensajero asignado
ALTER TABLE orders 
ADD COLUMN assigned_messenger_id INT DEFAULT NULL,
ADD COLUMN delivery_notes TEXT DEFAULT NULL,
ADD COLUMN expected_delivery_date DATETIME DEFAULT NULL,
ADD FOREIGN KEY (assigned_messenger_id) REFERENCES messengers(id);

-- 9. Insertar mensajeros de ejemplo
INSERT INTO messengers (name, phone, email, identification, transportation_type, commission_percentage, created_by) VALUES
('Carlos Rodríguez', '3001234567', 'carlos.rodriguez@email.com', '12345678', 'moto', 5.00, 1),
('María García', '3007654321', 'maria.garcia@email.com', '87654321', 'bicicleta', 4.00, 1),
('José López', '3009876543', 'jose.lopez@email.com', '11223344', 'moto', 5.00, 1),
('Ana Martínez', '3005544332', 'ana.martinez@email.com', '44332211', 'carro', 6.00, 1);

-- 10. Asignar zonas a mensajeros de ejemplo
INSERT INTO messenger_zones (messenger_id, zone_id, is_preferred) VALUES
(1, 1, true),  -- Carlos - Centro
(1, 2, false), -- Carlos - Norte
(2, 1, true),  -- María - Centro
(2, 3, true),  -- María - Sur
(3, 4, true),  -- José - Oriente
(3, 5, false), -- José - Occidente
(4, 6, true),  -- Ana - Área Metropolitana
(4, 2, false); -- Ana - Norte

-- 11. Crear vista para consultas optimizadas
CREATE VIEW messenger_summary AS
SELECT 
    m.id,
    m.name,
    m.phone,
    m.email,
    m.transportation_type,
    m.is_active,
    m.can_collect_payments,
    m.commission_percentage,
    COUNT(md.id) as total_deliveries,
    COUNT(CASE WHEN md.status = 'entregado' THEN 1 END) as completed_deliveries,
    COALESCE(SUM(md.payment_collected), 0) as total_collected,
    COALESCE(SUM(md.commission_amount), 0) as total_commission,
    GROUP_CONCAT(DISTINCT dz.name) as zones_covered
FROM messengers m
LEFT JOIN messenger_deliveries md ON m.id = md.messenger_id
LEFT JOIN messenger_zones mz ON m.id = mz.messenger_id
LEFT JOIN delivery_zones dz ON mz.zone_id = dz.id
GROUP BY m.id, m.name, m.phone, m.email, m.transportation_type, m.is_active, m.can_collect_payments, m.commission_percentage;

-- 12. Crear triggers para actualizar métricas automáticamente
DELIMITER //

CREATE TRIGGER update_messenger_performance_after_delivery
AFTER UPDATE ON messenger_deliveries
FOR EACH ROW
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('entregado', 'fallido') THEN
        INSERT INTO messenger_performance (
            messenger_id, 
            date, 
            total_deliveries, 
            successful_deliveries, 
            failed_deliveries,
            total_collected,
            total_commission
        )
        VALUES (
            NEW.messenger_id,
            DATE(NEW.updated_at),
            1,
            CASE WHEN NEW.status = 'entregado' THEN 1 ELSE 0 END,
            CASE WHEN NEW.status = 'fallido' THEN 1 ELSE 0 END,
            CASE WHEN NEW.status = 'entregado' THEN NEW.payment_collected ELSE 0 END,
            CASE WHEN NEW.status = 'entregado' THEN NEW.commission_amount ELSE 0 END
        )
        ON DUPLICATE KEY UPDATE
            total_deliveries = total_deliveries + 1,
            successful_deliveries = successful_deliveries + CASE WHEN NEW.status = 'entregado' THEN 1 ELSE 0 END,
            failed_deliveries = failed_deliveries + CASE WHEN NEW.status = 'fallido' THEN 1 ELSE 0 END,
            total_collected = total_collected + CASE WHEN NEW.status = 'entregado' THEN NEW.payment_collected ELSE 0 END,
            total_commission = total_commission + CASE WHEN NEW.status = 'entregado' THEN NEW.commission_amount ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
END//

DELIMITER ;

-- 13. Comentarios de documentación
-- Esta estructura permite:
-- - Gestionar mensajeros con información completa
-- - Asignar entregas específicas a mensajeros
-- - Trackear pagos cobrados por mensajeros
-- - Calcular comisiones automáticamente
-- - Generar reportes de rendimiento
-- - Gestionar zonas de cobertura
-- - Integrar con sistema de cartera

COMMIT;
