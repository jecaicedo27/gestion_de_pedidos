-- Fix: Agregar estado "por_entregar" correctamente al ENUM de orders
-- Este estado va entre "empacado" y los estados de entrega existentes

-- Primero, agregar el estado "por_entregar" al ENUM en la posición correcta
ALTER TABLE orders 
MODIFY COLUMN status ENUM(
    'pendiente_facturacion',
    'pendiente_por_facturacion', 
    'revision_cartera',
    'en_logistica',
    'en_preparacion',
    'listo',
    'en_empaque',
    'empacado',
    'por_entregar',  -- NUEVO ESTADO AQUÍ
    'pendiente_entrega_bodega',
    'pendiente_entrega_domicilio',
    'pendiente_envio_nacional',
    'pendiente_mensajeria',
    'en_reparto',
    'enviado',
    'entregado_transportadora',
    'entregado_cliente',
    'cancelado'
) DEFAULT 'pendiente_facturacion';

-- Crear tabla básica para tracking del estado "por_entregar"
CREATE TABLE IF NOT EXISTS por_entregar_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivery_method VARCHAR(50),
    origin_type VARCHAR(50),
    priority_level INT DEFAULT 1,
    assignment_notes TEXT,
    processed_by INT,
    processed_at TIMESTAMP NULL,
    status ENUM('pending', 'assigned', 'processed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_assigned_at (assigned_at)
);

-- Crear tabla básica de reglas de entrega (simplificada)
CREATE TABLE IF NOT EXISTS delivery_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    origin_type VARCHAR(50) NOT NULL,
    origin_location VARCHAR(100),
    delivery_method VARCHAR(50) NOT NULL,
    min_amount DECIMAL(10,2),
    max_amount DECIMAL(10,2),
    priority_level INT DEFAULT 1,
    auto_assign BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_origin_type (origin_type),
    INDEX idx_active (is_active),
    INDEX idx_priority (priority_level)
);

-- Insertar reglas básicas de entrega
INSERT INTO delivery_rules (name, origin_type, origin_location, delivery_method, min_amount, max_amount, priority_level, auto_assign, is_active) VALUES
('Entrega Local Estándar', 'local', 'Bogotá', 'domicilio', 0, 100000, 1, TRUE, TRUE),
('Entrega Local Express', 'local', 'Bogotá', 'mensajeria', 100001, NULL, 2, FALSE, TRUE),
('Envío Nacional', 'nacional', 'Colombia', 'transportadora', 0, NULL, 1, TRUE, TRUE),
('Recogida en Bodega', 'bodega', 'Principal', 'recogida', 0, NULL, 1, FALSE, TRUE)
ON DUPLICATE KEY UPDATE 
    updated_at = CURRENT_TIMESTAMP;

-- Migrar pedidos que deberían estar en "por_entregar"
-- Solo los que están en "empacado" y no tienen registro de entrega procesado
UPDATE orders 
SET status = 'por_entregar' 
WHERE status = 'empacado' 
  AND id NOT IN (
    SELECT DISTINCT order_id 
    FROM delivery_tracking 
    WHERE status IN ('delivered', 'completed')
  );

-- Crear registros en por_entregar_tracking para los pedidos migrados
INSERT INTO por_entregar_tracking (order_id, delivery_method, origin_type, assignment_notes)
SELECT 
    o.id,
    'domicilio' as delivery_method,
    'local' as origin_type,
    CONCAT('Migrado automáticamente desde empacado - ', DATE(o.updated_at)) as assignment_notes
FROM orders o
WHERE o.status = 'por_entregar'
  AND o.id NOT IN (SELECT order_id FROM por_entregar_tracking)
ON DUPLICATE KEY UPDATE 
    updated_at = CURRENT_TIMESTAMP;
