-- Tabla para gestionar suscripciones de webhooks de SIIGO
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    webhook_id VARCHAR(255) UNIQUE NOT NULL,
    application_id VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    company_key VARCHAR(255),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla para logs de webhooks recibidos
CREATE TABLE IF NOT EXISTS webhook_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    webhook_id VARCHAR(255),
    topic VARCHAR(255) NOT NULL,
    company_key VARCHAR(255),
    product_id VARCHAR(255),
    siigo_product_id VARCHAR(255),
    product_code VARCHAR(255),
    old_stock INT,
    new_stock INT,
    payload JSON,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX idx_webhook_subscriptions_topic ON webhook_subscriptions(topic);
CREATE INDEX idx_webhook_subscriptions_active ON webhook_subscriptions(active);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed);
CREATE INDEX idx_webhook_logs_siigo_product_id ON webhook_logs(siigo_product_id);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);
