-- Crear tabla de clientes para cotizaciones
CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    siigo_id VARCHAR(100) UNIQUE NOT NULL,
    document_type VARCHAR(20) NOT NULL,
    identification VARCHAR(50) NOT NULL,
    check_digit VARCHAR(5),
    name VARCHAR(255) NOT NULL,
    commercial_name VARCHAR(255),
    phone VARCHAR(50),
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Colombia',
    email VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices para búsqueda rápida
    INDEX idx_identification (identification),
    INDEX idx_name (name),
    INDEX idx_siigo_id (siigo_id),
    INDEX idx_active (active)
);

-- Crear tabla de cotizaciones
CREATE TABLE IF NOT EXISTS quotations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_number VARCHAR(50) UNIQUE,
    customer_id INT NOT NULL,
    siigo_customer_id VARCHAR(100) NOT NULL,
    raw_request TEXT NOT NULL, -- Pedido original en lenguaje natural
    processed_request JSON, -- Resultado procesado por ChatGPT
    status ENUM('draft', 'processing', 'completed', 'error', 'sent') DEFAULT 'draft',
    total_amount DECIMAL(15,2) DEFAULT 0,
    siigo_quotation_id VARCHAR(100), -- ID de cotización en SIIGO
    siigo_quotation_url VARCHAR(500), -- URL de la cotización en SIIGO
    processing_notes TEXT,
    error_message TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_quotation_number (quotation_number)
);

-- Crear tabla de items de cotización
CREATE TABLE IF NOT EXISTS quotation_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    product_code VARCHAR(100),
    product_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(15,2),
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    total_amount DECIMAL(15,2),
    siigo_product_id VARCHAR(100),
    processing_confidence DECIMAL(3,2), -- Confianza del procesamiento de ChatGPT (0-1)
    manual_review_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
    
    INDEX idx_quotation_id (quotation_id),
    INDEX idx_product_code (product_code)
);

-- Crear tabla para tracking de procesamiento con ChatGPT
CREATE TABLE IF NOT EXISTS chatgpt_processing_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    request_type ENUM('text', 'image') NOT NULL,
    input_content TEXT NOT NULL,
    chatgpt_response JSON,
    tokens_used INT,
    processing_time_ms INT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
    
    INDEX idx_quotation_id (quotation_id),
    INDEX idx_created_at (created_at)
);
