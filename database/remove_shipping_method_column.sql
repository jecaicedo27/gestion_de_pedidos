-- Script para eliminar el campo shipping_method de la tabla orders
-- Ya que solo usaremos delivery_method para simplificar

USE gestion_pedidos_dev;

-- Verificar que el campo existe antes de eliminarlo
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
AND TABLE_NAME = 'orders' 
AND COLUMN_NAME = 'shipping_method';

-- Eliminar el campo shipping_method
ALTER TABLE orders DROP COLUMN shipping_method;

-- Verificar que fue eliminado correctamente
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
AND TABLE_NAME = 'orders' 
AND COLUMN_NAME = 'shipping_method';
