-- Agregar columna shipping_date a la tabla orders si no existe
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipping_date DATE NULL 
COMMENT 'Fecha programada de envío para logística';

-- Verificar la estructura de la tabla
DESCRIBE orders;
