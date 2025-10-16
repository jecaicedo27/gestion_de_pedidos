-- Eliminar columna delivery_date redundante
-- Solo mantener shipping_date que es la fecha programada de envío

USE gestion_pedidos_dev;

-- Verificar la estructura actual
DESCRIBE orders;

-- Eliminar la columna delivery_date
ALTER TABLE orders DROP COLUMN delivery_date;

-- Verificar la estructura después del cambio
DESCRIBE orders;

-- Mostrar algunas filas para confirmar
SELECT 
    id, 
    order_number, 
    status, 
    shipping_date,
    created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 5;
