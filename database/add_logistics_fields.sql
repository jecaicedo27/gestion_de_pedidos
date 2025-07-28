-- Agregar campos de logística a la tabla orders
ALTER TABLE orders 
ADD COLUMN shipping_method ENUM(
  'recoge_bodega', 
  'domicilio_local', 
  'envio_nacional', 
  'envio_terminal', 
  'envio_aereo'
) DEFAULT 'domicilio_local' AFTER delivery_method,
ADD COLUMN carrier_id INT NULL AFTER shipping_method,
ADD COLUMN tracking_number VARCHAR(100) NULL AFTER carrier_id,
ADD COLUMN shipping_guide_generated BOOLEAN DEFAULT FALSE AFTER tracking_number,
ADD COLUMN shipping_guide_path VARCHAR(255) NULL AFTER shipping_guide_generated;

-- Crear tabla de transportadoras
CREATE TABLE IF NOT EXISTS carriers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  website VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar transportadoras comunes en Colombia
INSERT INTO carriers (name, code, contact_phone, contact_email, website) VALUES
('Servientrega', 'SERVIENTREGA', '018000111122', 'contacto@servientrega.com', 'https://www.servientrega.com'),
('TCC (Transportes Coordinados de Colombia)', 'TCC', '018000180000', 'servicio@tcc.com.co', 'https://www.tcc.com.co'),
('Envía', 'ENVIA', '018000123456', 'contacto@envia.co', 'https://www.envia.co'),
('Inter Rapidísimo', 'INTER', '018000111777', 'contacto@interrapidisimo.com', 'https://www.interrapidisimo.com'),
('Coordinadora', 'COORDINADORA', '018000122333', 'contacto@coordinadora.com', 'https://www.coordinadora.com'),
('Deprisa', 'DEPRISA', '018000333444', 'contacto@deprisa.com', 'https://www.deprisa.com'),
('Recogida en Bodega', 'BODEGA', '3105244298', 'logistica@perlas-explosivas.com', NULL);

-- Agregar índices para optimizar consultas
ALTER TABLE orders ADD INDEX idx_shipping_method (shipping_method);
ALTER TABLE orders ADD INDEX idx_carrier_id (carrier_id);
ALTER TABLE orders ADD INDEX idx_tracking_number (tracking_number);

-- Agregar foreign key constraint
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_carrier 
FOREIGN KEY (carrier_id) REFERENCES carriers(id) 
ON DELETE SET NULL ON UPDATE CASCADE;
