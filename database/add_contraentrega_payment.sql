-- Agregar método de pago "contraentrega"
-- Este script agrega la opción de contraentrega para clientes en Medellín

-- Verificar si ya existe el método de pago contraentrega
SELECT COUNT(*) as count FROM orders WHERE payment_method = 'contraentrega';

-- Si necesitamos agregar columnas adicionales para manejar contraentrega
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS actual_payment_method ENUM('efectivo', 'transferencia') NULL COMMENT 'Método real de pago usado en contraentrega',
ADD COLUMN IF NOT EXISTS payment_received_by_messenger DECIMAL(10,2) NULL COMMENT 'Monto recibido por el mensajero en efectivo',
ADD COLUMN IF NOT EXISTS payment_confirmed_by_wallet BOOLEAN DEFAULT FALSE COMMENT 'Confirmación de cartera para transferencias',
ADD COLUMN IF NOT EXISTS is_medellin_delivery BOOLEAN DEFAULT FALSE COMMENT 'Indica si es entrega en Medellín para contraentrega';

-- Crear tabla para tracking de pagos contraentrega
CREATE TABLE IF NOT EXISTS contraentrega_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    expected_amount DECIMAL(10,2) NOT NULL,
    actual_payment_method ENUM('efectivo', 'transferencia') NULL,
    amount_received DECIMAL(10,2) NULL,
    received_by_messenger_id INT NULL,
    confirmed_by_wallet_user_id INT NULL,
    payment_date TIMESTAMP NULL,
    confirmation_date TIMESTAMP NULL,
    notes TEXT NULL,
    status ENUM('pending', 'received', 'confirmed', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by_messenger_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (confirmed_by_wallet_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_payment_date (payment_date)
);

-- Crear tabla para tracking de efectivo del mensajero
CREATE TABLE IF NOT EXISTS messenger_cash_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    messenger_id INT NOT NULL,
    order_id INT NULL,
    transaction_type ENUM('received', 'delivered') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (messenger_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    
    INDEX idx_messenger_id (messenger_id),
    INDEX idx_transaction_date (transaction_date),
    INDEX idx_transaction_type (transaction_type)
);

-- Insertar datos de ejemplo para testing
INSERT IGNORE INTO contraentrega_payments (order_id, expected_amount, status) 
SELECT id, total_amount, 'pending' 
FROM orders 
WHERE payment_method = 'contraentrega' 
AND id NOT IN (SELECT order_id FROM contraentrega_payments);

-- Mostrar resumen
SELECT 
    'Órdenes con contraentrega' as description,
    COUNT(*) as count 
FROM orders 
WHERE payment_method = 'contraentrega'

UNION ALL

SELECT 
    'Registros en contraentrega_payments' as description,
    COUNT(*) as count 
FROM contraentrega_payments

UNION ALL

SELECT 
    'Mensajeros activos' as description,
    COUNT(*) as count 
FROM users 
WHERE role = 'mensajero' AND active = 1;
