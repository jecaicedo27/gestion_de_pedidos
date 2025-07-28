-- Tabla para gestión de cupos de crédito de clientes
CREATE TABLE IF NOT EXISTS customer_credit_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  available_credit DECIMAL(12,2) GENERATED ALWAYS AS (credit_limit - current_balance) STORED,
  status ENUM('active', 'suspended', 'blocked') DEFAULT 'active',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_customer_name (customer_name),
  INDEX idx_customer_phone (customer_phone),
  INDEX idx_status (status)
);

-- Tabla para validaciones de cartera
CREATE TABLE IF NOT EXISTS wallet_validations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  payment_method ENUM('transferencia', 'cliente_credito', 'efectivo') NOT NULL,
  validation_type ENUM('payment_proof', 'credit_check', 'cash_verification') NOT NULL,
  
  -- Para comprobantes de pago (transferencias y efectivo)
  payment_proof_image VARCHAR(500),
  payment_reference VARCHAR(100),
  payment_amount DECIMAL(10,2),
  payment_date DATE,
  bank_name VARCHAR(100),
  
  -- Para validación de crédito
  customer_credit_limit DECIMAL(12,2),
  customer_current_balance DECIMAL(12,2),
  credit_approved BOOLEAN DEFAULT FALSE,
  
  -- Estado de validación
  validation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  validation_notes TEXT,
  validated_by INT,
  validated_at TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_order_id (order_id),
  INDEX idx_payment_method (payment_method),
  INDEX idx_validation_status (validation_status)
);

-- Insertar algunos clientes de ejemplo con cupos de crédito
INSERT IGNORE INTO customer_credit_limits (customer_name, customer_phone, customer_email, credit_limit, current_balance, status, notes, created_by) VALUES
('JUDIT XIMENA BENAVIDES PABON', '3167250636', 'judit@example.com', 500000.00, 248100.00, 'active', 'Cliente frecuente con buen historial', 1),
('Rio exprés LD S.A.S.', NULL, 'rioexpress@example.com', 1000000.00, 375000.00, 'active', 'Empresa distribuidora', 1),
('JOHN EDISSON CAICEDO BENAVIDES', NULL, 'john@example.com', 200000.00, 106.00, 'active', 'Cliente regular', 1),
('Mostrador Ocasional', '3105244298', 'perlasexplosivasfacturacion@gmail.com', 100000.00, 0.00, 'active', 'Cliente mostrador', 1);
