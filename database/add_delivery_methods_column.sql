-- Agregar columna delivery_methods a la tabla orders
-- Esta columna almacenará el método de entrega seleccionado

ALTER TABLE orders 
ADD COLUMN delivery_methods VARCHAR(100) NULL 
COMMENT 'Método de entrega del pedido (ej: entrega_con_drone, entrega_rapida, etc.)';

-- Mostrar la estructura actualizada
DESCRIBE orders;
