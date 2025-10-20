-- Sistema completo de gestión de entregas para mensajeros

-- 1. Agregar campos a la tabla de pedidos para el flujo de mensajería
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS messenger_status ENUM(
    'pending_assignment',    -- Pendiente de asignación por logística
    'assigned',              -- Asignado a mensajero
    'accepted',              -- Aceptado por mensajero
    'rejected',              -- Rechazado por mensajero
    'in_delivery',           -- En proceso de entrega
    'delivered',             -- Entregado exitosamente
    'delivery_failed',       -- Entrega fallida
    'returned_to_logistics'  -- Devuelto a logística para reasignación
) DEFAULT 'pending_assignment' AFTER status,

ADD COLUMN IF NOT EXISTS delivery_attempts INT DEFAULT 0 AFTER messenger_status,
ADD COLUMN IF NOT EXISTS requires_payment BOOLEAN DEFAULT FALSE AFTER delivery_attempts,
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2) DEFAULT 0.00 AFTER requires_payment,
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0.00 AFTER payment_amount;

-- 2. Tabla para tracking detallado de entregas
CREATE TABLE IF NOT EXISTS delivery_tracking (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    messenger_id INT NOT NULL,
    
    -- Estados y timestamps
    assigned_at TIMESTAMP NULL,
    accepted_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    started_delivery_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    failed_at TIMESTAMP NULL,
    
    -- Información de la entrega
    rejection_reason TEXT NULL,
    failure_reason TEXT NULL,
    delivery_notes TEXT NULL,
    
    -- Información de pagos
    payment_collected DECIMAL(10,2) DEFAULT 0.00,
    delivery_fee_collected DECIMAL(10,2) DEFAULT 0.00,
    payment_method ENUM('efectivo', 'transferencia', 'tarjeta') NULL,
    
    -- Ubicación (futuro GPS)
    delivery_latitude DECIMAL(10, 8) NULL,
    delivery_longitude DECIMAL(11, 8) NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (messenger_id) REFERENCES users(id),
    INDEX idx_order_messenger (order_id, messenger_id),
    INDEX idx_messenger_status (messenger_id, assigned_at),
    INDEX idx_delivery_date (delivered_at)
);

-- 3. Tabla para evidencias fotográficas
CREATE TABLE IF NOT EXISTS delivery_evidence (
    id INT PRIMARY KEY AUTO_INCREMENT,
    delivery_tracking_id INT NOT NULL,
    order_id INT NOT NULL,
    messenger_id INT NOT NULL,
    
    -- Información de la foto
    photo_filename VARCHAR(255) NOT NULL,
    photo_path VARCHAR(500) NOT NULL,
    photo_size INT NULL,
    photo_type VARCHAR(50) NULL,
    
    -- Metadatos
    description TEXT NULL,
    taken_at TIMESTAMP NOT NULL,
    upload_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (delivery_tracking_id) REFERENCES delivery_tracking(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (messenger_id) REFERENCES users(id),
    INDEX idx_order_evidence (order_id),
    INDEX idx_messenger_evidence (messenger_id)
);

-- 4. Tabla para cierre de caja de mensajeros
CREATE TABLE IF NOT EXISTS messenger_cash_closure (
    id INT PRIMARY KEY AUTO_INCREMENT,
    messenger_id INT NOT NULL,
    closure_date DATE NOT NULL,
    
    -- Totales del día
    total_deliveries INT DEFAULT 0,
    total_payment_collected DECIMAL(10,2) DEFAULT 0.00,
    total_delivery_fees DECIMAL(10,2) DEFAULT 0.00,
    total_cash_collected DECIMAL(10,2) DEFAULT 0.00,
    
    -- Estado del cierre
    status ENUM('open', 'submitted', 'approved', 'paid') DEFAULT 'open',
    submitted_at TIMESTAMP NULL,
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,
    paid_at TIMESTAMP NULL,
    
    -- Observaciones
    messenger_notes TEXT NULL,
    admin_notes TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (messenger_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    UNIQUE KEY unique_messenger_date (messenger_id, closure_date),
    INDEX idx_closure_date (closure_date),
    INDEX idx_messenger_closures (messenger_id, closure_date)
);

-- 5. Tabla para detalles del cierre de caja
CREATE TABLE IF NOT EXISTS messenger_cash_closure_details (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cash_closure_id INT NOT NULL,
    delivery_tracking_id INT NOT NULL,
    order_id INT NOT NULL,
    
    -- Montos específicos de esta entrega
    payment_collected DECIMAL(10,2) DEFAULT 0.00,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    payment_method ENUM('efectivo', 'transferencia', 'tarjeta') NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (cash_closure_id) REFERENCES messenger_cash_closure(id),
    FOREIGN KEY (delivery_tracking_id) REFERENCES delivery_tracking(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_closure_details (cash_closure_id),
    INDEX idx_tracking_details (delivery_tracking_id)
);

-- 6. Actualizar estados existentes para compatibilidad
UPDATE orders SET messenger_status = 'pending_assignment' WHERE messenger_status IS NULL;

-- 7. Crear índices adicionales para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_orders_messenger_status ON orders(messenger_status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_messenger ON orders(assigned_messenger_id, messenger_status);

-- 8. Datos iniciales para testing
-- Marcar pedidos existentes como pendientes de asignación
UPDATE orders 
SET messenger_status = 'assigned' 
WHERE assigned_messenger_id IS NOT NULL AND status IN ('empacado', 'listo_para_entrega');

COMMIT;
