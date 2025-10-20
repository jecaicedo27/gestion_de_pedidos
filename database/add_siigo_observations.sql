-- Agregar campo para observaciones de SIIGO
-- Este campo almacenará las observaciones/notas que vienen de SIIGO

ALTER TABLE orders 
ADD COLUMN siigo_observations TEXT NULL COMMENT 'Observaciones y notas importadas desde SIIGO';

-- Verificar que la columna se agregó correctamente
DESCRIBE orders;
