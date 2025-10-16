-- Actualizar ENUM de estados de pedidos para incluir empaque obligatorio
ALTER TABLE orders MODIFY COLUMN status ENUM(
  'pendiente_facturacion',
  'revision_cartera', 
  'en_logistica',
  'en_preparacion',
  'pendiente_empaque',
  'en_empaque',
  'listo_reparto',
  'en_reparto',
  'entregado_transportadora',
  'entregado_cliente',
  'cancelado',
  'requires_review'
) NOT NULL DEFAULT 'pendiente_facturacion';

-- Migrar pedidos existentes que estaban en 'listo' a 'pendiente_empaque'
-- para que pasen por el nuevo flujo obligatorio
UPDATE orders 
SET status = 'pendiente_empaque' 
WHERE status = 'listo';

-- Nota: Los pedidos que están en 'en_reparto' se quedan así porque ya están en proceso
