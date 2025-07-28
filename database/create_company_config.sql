-- Crear tabla de configuración de empresa
CREATE TABLE IF NOT EXISTS company_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(255) NOT NULL,
  nit VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  city VARCHAR(100),
  department VARCHAR(100),
  postal_code VARCHAR(20),
  website VARCHAR(255),
  logo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar configuración inicial si no existe
INSERT IGNORE INTO company_config (
  id, company_name, nit, email, address, whatsapp, city, department
) VALUES (
  1, 
  'Tu Empresa', 
  '000000000-0', 
  'info@tuempresa.com', 
  'Dirección de tu empresa', 
  '+57 300 000 0000',
  'Bogotá',
  'Cundinamarca'
);
