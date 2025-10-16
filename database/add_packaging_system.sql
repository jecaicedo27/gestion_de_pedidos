-- Actualizar ENUM de status para incluir el estado de empaque
ALTER TABLE orders 
MODIFY COLUMN status ENUM(
  'pendiente_facturacion',
  'revision_cartera', 
  'en_logistica',
  'en_empaque',
  'en_reparto',
  'entregado_transportadora',
  'entregado_cliente',
  'cancelado',
  'pendiente',
  'confirmado',
  'en_preparacion',
  'listo',
  'enviado',
  'entregado'
) DEFAULT 'pendiente_facturacion';

-- Crear tabla para el sistema de empaque y checklist
CREATE TABLE IF NOT EXISTS packaging_checklists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  item_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  required_quantity DECIMAL(10,3) NOT NULL,
  required_unit VARCHAR(50) NOT NULL,
  required_weight DECIMAL(10,3) DEFAULT NULL,
  required_flavor VARCHAR(100) DEFAULT NULL,
  required_size VARCHAR(50) DEFAULT NULL,
  
  -- Datos de verificación
  packed_quantity DECIMAL(10,3) DEFAULT NULL,
  packed_weight DECIMAL(10,3) DEFAULT NULL,
  packed_flavor VARCHAR(100) DEFAULT NULL,
  packed_size VARCHAR(50) DEFAULT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_notes TEXT DEFAULT NULL,
  
  -- Información del empacador
  packed_by INT DEFAULT NULL,
  packed_at TIMESTAMP NULL DEFAULT NULL,
  verified_by INT DEFAULT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (packed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_order_packaging (order_id),
  INDEX idx_item_packaging (item_id),
  INDEX idx_verification_status (is_verified)
);

-- Crear tabla para seguimiento de empaque de pedidos
CREATE TABLE IF NOT EXISTS order_packaging_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL UNIQUE,
  
  -- Estado del empaque
  packaging_status ENUM('pending', 'in_progress', 'completed', 'requires_review') DEFAULT 'pending',
  total_items INT NOT NULL DEFAULT 0,
  verified_items INT NOT NULL DEFAULT 0,
  
  -- Información del proceso
  started_by INT DEFAULT NULL,
  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_by INT DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  
  -- Notas generales del empaque
  packaging_notes TEXT DEFAULT NULL,
  quality_check_passed BOOLEAN DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_packaging_status (packaging_status),
  INDEX idx_order_packaging_status (order_id)
);

-- Crear tabla para plantillas de empaque por tipo de producto
CREATE TABLE IF NOT EXISTS packaging_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(100) DEFAULT NULL,
  
  -- Especificaciones del producto
  standard_weight DECIMAL(10,3) DEFAULT NULL,
  weight_unit VARCHAR(20) DEFAULT 'kg',
  available_flavors TEXT DEFAULT NULL, -- JSON array de sabores disponibles
  available_sizes TEXT DEFAULT NULL,   -- JSON array de tamaños disponibles
  
  -- Instrucciones de empaque
  packaging_instructions TEXT DEFAULT NULL,
  quality_checks TEXT DEFAULT NULL,   -- JSON array de checks de calidad
  common_errors TEXT DEFAULT NULL,    -- JSON array de errores comunes
  
  -- Control
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_product_name (product_name),
  INDEX idx_product_code (product_code),
  INDEX idx_active_templates (is_active)
);

-- Insertar plantillas básicas para productos comunes
INSERT INTO packaging_templates (product_name, standard_weight, weight_unit, available_flavors, packaging_instructions, quality_checks, common_errors) VALUES
('Perlas Explosivas', 1.0, 'kg', '["Original", "Picante", "BBQ", "Queso", "Dulce"]', 
 'Verificar peso exacto con balanza digital. Confirmar sabor en etiqueta del empaque.', 
 '["Peso correcto", "Sabor correcto", "Empaque sellado", "Etiqueta clara"]',
 '["Confusión de sabores", "Peso incorrecto", "Empaque mal sellado"]'),

('Perlas Mini', 0.5, 'kg', '["Original", "Picante", "Queso"]',
 'Peso estándar 500g. Verificar que el empaque sea el tamaño mini.',
 '["Peso 500g exacto", "Sabor correcto", "Empaque tamaño mini", "Sellado perfecto"]',
 '["Confundir con perlas grandes", "Peso incorrecto"]'),

('Perlas Familiares', 2.0, 'kg', '["Original", "Picante", "BBQ", "Queso"]',
 'Peso estándar 2kg. Usar empaque familiar grande. Verificar doble sellado.',
 '["Peso 2kg exacto", "Empaque familiar", "Doble sellado", "Sabor correcto"]',
 '["Usar empaque incorrecto", "Sellado simple en lugar de doble"]');
