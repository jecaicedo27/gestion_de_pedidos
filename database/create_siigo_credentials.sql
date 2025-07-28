-- Crear tabla para credenciales de SIIGO por empresa
CREATE TABLE IF NOT EXISTS siigo_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT DEFAULT 1 COMMENT 'ID de la empresa (para multi-tenancy futuro)',
    siigo_username VARCHAR(255) NOT NULL COMMENT 'Usuario de SIIGO API',
    siigo_access_key TEXT NOT NULL COMMENT 'Access Key de SIIGO API (encriptado)',
    siigo_base_url VARCHAR(255) DEFAULT 'https://api.siigo.com/v1' COMMENT 'URL base de SIIGO API',
    webhook_secret TEXT NULL COMMENT 'Secret para validar webhooks de SIIGO',
    is_enabled BOOLEAN DEFAULT TRUE COMMENT 'Si las credenciales están habilitadas',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NULL COMMENT 'Usuario que creó las credenciales',
    updated_by INT NULL COMMENT 'Usuario que actualizó las credenciales',
    
    UNIQUE KEY unique_company_siigo (company_id),
    INDEX idx_company_enabled (company_id, is_enabled),
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Credenciales de SIIGO por empresa';

-- Insertar credenciales por defecto (si no existen)
INSERT IGNORE INTO siigo_credentials (
    company_id, 
    siigo_username, 
    siigo_access_key, 
    siigo_base_url, 
    webhook_secret, 
    is_enabled,
    created_by
) VALUES (
    1,
    'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
    'default_access_key_to_be_updated',
    'https://api.siigo.com/v1',
    'default_webhook_secret',
    TRUE,
    1
);
