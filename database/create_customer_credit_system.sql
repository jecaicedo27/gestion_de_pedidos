-- Crear tabla para gestión de crédito de clientes
CREATE TABLE IF NOT EXISTS customer_credit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_nit VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    available_credit DECIMAL(15,2) GENERATED ALWAYS AS (credit_limit - current_balance) STORED,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_customer_nit (customer_nit),
    INDEX idx_customer_name (customer_name),
    INDEX idx_status (status),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Crear tabla para historial de movimientos de crédito
CREATE TABLE IF NOT EXISTS customer_credit_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_credit_id INT NOT NULL,
    order_id INT,
    movement_type ENUM('charge', 'payment', 'adjustment', 'credit_increase', 'credit_decrease') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    previous_balance DECIMAL(15,2) NOT NULL,
    new_balance DECIMAL(15,2) NOT NULL,
    description TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_customer_credit (customer_credit_id),
    INDEX idx_order (order_id),
    INDEX idx_movement_type (movement_type),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (customer_credit_id) REFERENCES customer_credit(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Insertar algunos clientes de ejemplo
INSERT IGNORE INTO customer_credit (customer_nit, customer_name, credit_limit, current_balance, status, notes, created_by) VALUES
('900123456-1', 'DISTRIBUCIONES EL PANADERO LA MAYORISTA S.A.S.', 10000000.00, 0.00, 'active', 'Cliente mayorista con cupo alto', 1),
('800987654-2', 'COMERCIALIZADORA ABC LTDA', 5000000.00, 0.00, 'active', 'Cliente regular', 1),
('700555444-3', 'SUPERMERCADOS XYZ S.A.S.', 15000000.00, 0.00, 'active', 'Cadena de supermercados', 1);
