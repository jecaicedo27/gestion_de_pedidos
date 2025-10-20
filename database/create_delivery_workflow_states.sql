-- Agregar nuevos estados para el flujo de entrega
-- Estados organizados por tipo de delivery method

ALTER TABLE orders MODIFY COLUMN status ENUM(
  'pendiente_facturacion',
  'pendiente_por_facturacion', 
  'revision_cartera',
  'en_logistica',
  'en_preparacion',
  'listo',
  'en_empaque',
  'empacado',
  'pendiente_entrega_bodega',      -- Para recogida_tienda/recoge_bodega
  'pendiente_entrega_domicilio',   -- Para domicilio/domicilio_ciudad/domicilio_nacional
  'pendiente_envio_nacional',      -- Para envio_nacional/envio_internacional
  'pendiente_mensajeria',          -- Para mensajeria_urbana/envio_especial/drone_delivery/fast
  'en_reparto',
  'enviado',
  'entregado_transportadora',
  'entregado_cliente',
  'cancelado'
) NOT NULL DEFAULT 'pendiente_facturacion';

-- Crear tabla para tracking de entregas
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  delivery_type ENUM('bodega', 'domicilio', 'nacional', 'mensajeria') NOT NULL,
  status ENUM('pendiente', 'preparando', 'listo', 'despachado', 'entregado') NOT NULL DEFAULT 'pendiente',
  assigned_to INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Crear índices para optimizar consultas
CREATE INDEX idx_delivery_tracking_order_id ON delivery_tracking(order_id);
CREATE INDEX idx_delivery_tracking_type ON delivery_tracking(delivery_type);
CREATE INDEX idx_delivery_tracking_status ON delivery_tracking(status);
CREATE INDEX idx_orders_status_delivery ON orders(status, delivery_method);
