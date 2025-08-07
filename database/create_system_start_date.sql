-- Crear tabla para almacenar la fecha de inicio del sistema de gestión de pedidos
-- Esta fecha determina desde cuándo se deben importar facturas de SIIGO

CREATE TABLE IF NOT EXISTS system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    data_type ENUM('string', 'number', 'date', 'boolean', 'json') DEFAULT 'string',
    created_by INT,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_config_key (config_key),
    INDEX idx_data_type (data_type)
);

-- Insertar la configuración de fecha de inicio del sistema
-- Por defecto, usar una fecha reciente para evitar importar facturas muy antiguas
INSERT INTO system_config (
    config_key, 
    config_value, 
    description, 
    data_type,
    created_by
) VALUES (
    'siigo_start_date',
    '2025-01-01',
    'Fecha de inicio para la importación de facturas SIIGO. Solo se importarán facturas creadas desde esta fecha en adelante.',
    'date',
    1
) ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    data_type = VALUES(data_type),
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración para habilitar/deshabilitar el filtro de fecha
INSERT INTO system_config (
    config_key, 
    config_value, 
    description, 
    data_type,
    created_by
) VALUES (
    'siigo_start_date_enabled',
    'true',
    'Determina si se debe aplicar el filtro de fecha de inicio para la importación de facturas SIIGO.',
    'boolean',
    1
) ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    data_type = VALUES(data_type),
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración para mostrar advertencia sobre facturas históricas
INSERT INTO system_config (
    config_key, 
    config_value, 
    description, 
    data_type,
    created_by
) VALUES (
    'siigo_historical_warning',
    'true',
    'Determina si se debe mostrar una advertencia sobre facturas históricas anteriores a la fecha de inicio.',
    'boolean',
    1
) ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    data_type = VALUES(data_type),
    updated_at = CURRENT_TIMESTAMP;

SELECT 'Tabla system_config creada y configuraciones iniciales insertadas exitosamente' as message;
