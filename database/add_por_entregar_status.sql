-- Agregar nuevo estado "por_entregar" entre empaque y mensajero
-- Este estado contendrá todos los pedidos que ya están empacados y listos para entrega
-- según reglas específicas dependiendo de su origen

ALTER TABLE orders MODIFY COLUMN status ENUM(
  'pendiente_facturacion',
  'revision_cartera', 
  'en_logistica',
  'en_preparacion',
  'pendiente_empaque',
  'en_empaque',
  'por_entregar',  -- Nuevo estado agregado aquí
  'listo_reparto',
  'en_reparto',
  'entregado_transportadora',
  'entregado_cliente',
  'cancelado',
  'requires_review'
) NOT NULL DEFAULT 'pendiente_facturacion';

-- Migrar pedidos existentes que están en 'listo_reparto' a 'por_entregar'
-- para que pasen por el nuevo flujo
UPDATE orders 
SET status = 'por_entregar' 
WHERE status = 'listo_reparto';

-- Crear tabla para reglas de entrega basadas en origen
CREATE TABLE IF NOT EXISTS delivery_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  origin_type ENUM('bodega', 'sucursal', 'proveedor', 'fabrica') NOT NULL,
  origin_location VARCHAR(100) NOT NULL,
  delivery_method ENUM('mensajero', 'transportadora', 'cliente_retira', 'entrega_directa') NOT NULL,
  min_amount DECIMAL(10,2) DEFAULT 0.00,
  max_amount DECIMAL(10,2) DEFAULT NULL,
  delivery_zone VARCHAR(50),
  priority_level ENUM('baja', 'media', 'alta', 'urgente') DEFAULT 'media',
  auto_assign BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_origin_type (origin_type),
  INDEX idx_origin_location (origin_location),
  INDEX idx_delivery_method (delivery_method),
  INDEX idx_delivery_zone (delivery_zone),
  INDEX idx_is_active (is_active)
);

-- Insertar reglas de entrega por defecto
INSERT INTO delivery_rules (origin_type, origin_location, delivery_method, min_amount, max_amount, delivery_zone, priority_level, auto_assign) VALUES
('bodega', 'Principal', 'mensajero', 0.00, 500000.00, 'zona_norte', 'media', TRUE),
('bodega', 'Principal', 'transportadora', 500000.01, NULL, 'nacional', 'alta', TRUE),
('sucursal', 'Centro', 'cliente_retira', 0.00, NULL, 'centro', 'baja', FALSE),
('proveedor', 'Externo', 'entrega_directa', 0.00, NULL, 'local', 'media', FALSE);

-- Crear tabla para tracking del estado por_entregar
CREATE TABLE IF NOT EXISTS por_entregar_tracking (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  assigned_rule_id INT,
  suggested_delivery_method ENUM('mensajero', 'transportadora', 'cliente_retira', 'entrega_directa'),
  assignment_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  processed_by INT,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_rule_id) REFERENCES delivery_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_order_id (order_id),
  INDEX idx_assigned_rule (assigned_rule_id),
  INDEX idx_processed_at (processed_at)
);

-- Trigger para asignar automáticamente reglas cuando un pedido pasa a por_entregar
DELIMITER //
CREATE TRIGGER after_status_por_entregar
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NEW.status = 'por_entregar' AND OLD.status != 'por_entregar' THEN
        -- Buscar regla aplicable basada en monto y origen del pedido
        INSERT INTO por_entregar_tracking (order_id, assigned_rule_id, suggested_delivery_method, assignment_notes)
        SELECT 
            NEW.id,
            dr.id,
            dr.delivery_method,
            CONCAT('Auto-asignado por regla: ', dr.origin_type, ' - ', dr.origin_location)
        FROM delivery_rules dr
        WHERE dr.is_active = TRUE
          AND (dr.min_amount <= NEW.total_amount OR dr.min_amount IS NULL)
          AND (dr.max_amount >= NEW.total_amount OR dr.max_amount IS NULL)
          AND dr.auto_assign = TRUE
        ORDER BY dr.priority_level DESC, dr.min_amount ASC
        LIMIT 1;
    END IF;
END//
DELIMITER ;

-- Comentarios sobre el flujo
-- 1. Los pedidos pasan de 'en_empaque' a 'por_entregar' cuando terminan el empaque
-- 2. En 'por_entregar' se evalúan las reglas de entrega según origen y monto
-- 3. Se asigna automáticamente un método de entrega sugerido
-- 4. El usuario puede revisar y confirmar antes de pasar a 'listo_reparto'
-- 5. De 'listo_reparto' continúan con el flujo normal hacia 'en_reparto'
