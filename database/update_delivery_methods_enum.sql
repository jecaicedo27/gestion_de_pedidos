-- Actualizar enum de delivery_method para incluir todos los métodos de la tabla delivery_methods
-- Esto permitirá que los nuevos métodos aparezcan dinámicamente en el frontend

USE gestion_pedidos_dev;

-- Actualizar el enum de orders.delivery_method para incluir los nuevos códigos
ALTER TABLE orders MODIFY COLUMN delivery_method 
ENUM(
    'domicilio', 
    'recogida_tienda', 
    'envio_nacional', 
    'envio_internacional', 
    'mensajeria_urbana', 
    'envio_especial'
);

-- Verificar el cambio
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
AND TABLE_NAME = 'orders' 
AND COLUMN_NAME = 'delivery_method';
