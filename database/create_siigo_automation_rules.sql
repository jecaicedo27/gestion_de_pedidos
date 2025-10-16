-- Crear tabla para reglas de automatización SIIGO
CREATE TABLE IF NOT EXISTS siigo_automation_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0, -- Orden de evaluación de las reglas
    
    -- Criterios de la regla
    criteria_type ENUM('all', 'client_name', 'total_amount', 'contains_product', 'time_range') NOT NULL DEFAULT 'all',
    criteria_operator ENUM('equals', 'contains', 'greater_than', 'less_than', 'between', 'in_list') NOT NULL DEFAULT 'equals',
    criteria_value TEXT, -- JSON para valores complejos o texto simple
    
    -- Acción a tomar
    action ENUM('auto_import', 'notify_only', 'ignore') NOT NULL DEFAULT 'auto_import',
    
    -- Metadatos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Crear tabla para configuración general de automatización
CREATE TABLE IF NOT EXISTS siigo_automation_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    automation_enabled BOOLEAN DEFAULT TRUE,
    default_action ENUM('auto_import', 'notify_only', 'ignore') DEFAULT 'notify_only',
    notification_email VARCHAR(255),
    last_execution TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Crear tabla para facturas pendientes de revisión
CREATE TABLE IF NOT EXISTS siigo_pending_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    siigo_invoice_id VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(255),
    client_name VARCHAR(255),
    total_amount DECIMAL(15,2),
    invoice_date DATE,
    rule_matched VARCHAR(255), -- Nombre de la regla que coincidió
    action_taken ENUM('pending', 'processed', 'ignored') DEFAULT 'pending',
    invoice_data JSON, -- Datos completos de la factura de SIIGO
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    UNIQUE KEY unique_siigo_invoice (siigo_invoice_id)
);

-- Insertar configuración por defecto
INSERT INTO siigo_automation_config (automation_enabled, default_action) 
VALUES (TRUE, 'notify_only') 
ON DUPLICATE KEY UPDATE automation_enabled = automation_enabled;

-- Insertar algunas reglas por defecto
INSERT INTO siigo_automation_rules (rule_name, criteria_type, criteria_operator, criteria_value, action, priority) VALUES
('Facturas pequeñas - Auto Import', 'total_amount', 'less_than', '100000', 'auto_import', 1),
('Facturas grandes - Revisar', 'total_amount', 'greater_than', '500000', 'notify_only', 2),
('Cliente VIP - Auto Import', 'client_name', 'contains', 'Distribuciones Panadero', 'auto_import', 3)
ON DUPLICATE KEY UPDATE rule_name = rule_name;

SELECT 'Tablas de automatización SIIGO creadas exitosamente' as resultado;
