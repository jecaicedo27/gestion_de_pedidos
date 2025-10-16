-- Script para agregar la columna invoice_code a la tabla orders
USE gestion_pedidos_dev;

-- Verificar si la columna ya existe
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
  AND TABLE_NAME = 'orders' 
  AND COLUMN_NAME = 'invoice_code';

-- Agregar la columna invoice_code si no existe
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS invoice_code VARCHAR(50) AFTER order_number;

-- Agregar índice para la nueva columna
CREATE INDEX IF NOT EXISTS idx_invoice_code ON orders(invoice_code);

-- Verificar que la columna se agregó correctamente
DESCRIBE orders;
