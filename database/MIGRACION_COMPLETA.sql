-- =================================================================
-- SISTEMA DE GESTIÓN DE PEDIDOS - PERLAS EXPLOSIVAS
-- Migración Completa de Base de Datos
-- Fecha: 8 de Agosto 2025
-- =================================================================

-- Crear base de datos si no existe
CREATE DATABASE IF NOT EXISTS `gestion_pedidos_dev` 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `gestion_pedidos_dev`;

-- =================================================================
-- TABLA: users
-- =================================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) UNIQUE NOT NULL,
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'facturador', 'cartera', 'logistica', 'mensajero', 'empacador', 'panadero') NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20),
  `active` BOOLEAN DEFAULT TRUE,
  `permissions` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` TIMESTAMP NULL,
  `partner_id` INT DEFAULT NULL,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_active (active),
  INDEX idx_partner_id (partner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: orders
-- =================================================================
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_number` VARCHAR(50) UNIQUE NOT NULL,
  `invoice_code` VARCHAR(50),
  `customer_name` VARCHAR(100) NOT NULL,
  `customer_phone` VARCHAR(20) NOT NULL,
  `customer_address` TEXT NOT NULL,
  `customer_email` VARCHAR(100),
  `customer_department` VARCHAR(100),
  `customer_city` VARCHAR(100),
  `customer_country` VARCHAR(100) DEFAULT 'Colombia',
  `customer_identification` VARCHAR(50),
  `customer_id_type` VARCHAR(50),
  `customer_person_type` VARCHAR(50),
  `delivery_method` ENUM('recoge_bodega', 'domicilio', 'envio_nacional', 'envio_internacional', 
                         'domicilio_ciudad', 'recogida_tienda', 'mensajeria_urbana') DEFAULT 'domicilio',
  `payment_method` ENUM('efectivo', 'transferencia', 'tarjeta_credito', 'pago_electronico', 
                        'cheque', 'credito', 'contraentrega', 'cortesia', 'datafono', 'auto') DEFAULT 'efectivo',
  `status` ENUM('pendiente', 'pendiente_por_facturacion', 'confirmado', 'en_preparacion', 
                'listo', 'enviado', 'entregado', 'cancelado', 'revision_cartera', 
                'en_logistica', 'en_empaque', 'en_reparto', 'entregado_transportadora', 
                'entregado_cliente', 'pendiente_facturacion', 'listo_para_entrega', 'por_entregar') DEFAULT 'pendiente',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT,
  `shipping_date` DATE,
  `created_by` INT NOT NULL,
  `assigned_to` INT NULL,
  `assigned_guide_id` INT NULL,
  `carrier_id` INT NULL,
  `shipping_guide_number` VARCHAR(100),
  `shipping_type` VARCHAR(50),
  `siigo_invoice_id` VARCHAR(100),
  `siigo_invoice_number` VARCHAR(100),
  `siigo_customer_id` VARCHAR(100),
  `siigo_public_url` VARCHAR(500),
  `order_source` ENUM('manual', 'siigo_automatic') DEFAULT 'manual',
  `siigo_observations` TEXT,
  `parsing_status` ENUM('auto_success', 'needs_review', 'manual_corrected') DEFAULT 'auto_success',
  `packaging_started_at` TIMESTAMP NULL,
  `packaging_completed_at` TIMESTAMP NULL,
  `packaged_by` INT NULL,
  `packaging_checklist` JSON,
  `is_deleted` BOOLEAN DEFAULT FALSE,
  `deleted_at` TIMESTAMP NULL,
  `deleted_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (packaged_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_guide_id) REFERENCES manual_shipping_guides(id) ON DELETE SET NULL,
  INDEX idx_order_number (order_number),
  INDEX idx_invoice_code (invoice_code),
  INDEX idx_customer_name (customer_name),
  INDEX idx_customer_phone (customer_phone),
  INDEX idx_status (status),
  INDEX idx_created_by (created_by),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created_at (created_at),
  INDEX idx_shipping_date (shipping_date),
  INDEX idx_delivery_method (delivery_method),
  INDEX idx_payment_method (payment_method),
  INDEX idx_siigo_invoice_id (siigo_invoice_id),
  INDEX idx_order_source (order_source),
  INDEX idx_parsing_status (parsing_status),
  INDEX idx_is_deleted (is_deleted),
  INDEX idx_carrier_id (carrier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: order_items
-- =================================================================
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `product_code` VARCHAR(100),
  `name` VARCHAR(200) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `price` DECIMAL(10,2) NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_name (name),
  INDEX idx_product_code (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: carriers
-- =================================================================
CREATE TABLE IF NOT EXISTS `carriers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `phone` VARCHAR(20),
  `website` VARCHAR(255),
  `tracking_url_template` VARCHAR(500),
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: company_config
-- =================================================================
CREATE TABLE IF NOT EXISTS `company_config` (
  `id` INT PRIMARY KEY DEFAULT 1,
  `name` VARCHAR(100) NOT NULL DEFAULT 'Mi Empresa',
  `logo_url` VARCHAR(255) DEFAULT '',
  `primary_color` VARCHAR(7) DEFAULT '#3B82F6',
  `secondary_color` VARCHAR(7) DEFAULT '#1E40AF',
  `address` TEXT,
  `phone` VARCHAR(20),
  `email` VARCHAR(100),
  `nit` VARCHAR(50),
  `legal_name` VARCHAR(200),
  `whatsapp_business_number` VARCHAR(20),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: system_config
-- =================================================================
CREATE TABLE IF NOT EXISTS `system_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `config_key` VARCHAR(100) UNIQUE NOT NULL,
  `config_value` TEXT,
  `config_type` ENUM('string', 'number', 'boolean', 'json', 'date') DEFAULT 'string',
  `description` TEXT,
  `is_sensitive` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key),
  INDEX idx_is_sensitive (is_sensitive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: wallet_balances
-- =================================================================
CREATE TABLE IF NOT EXISTS `wallet_balances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `partner_id` INT NOT NULL,
  `balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `last_movement_date` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_partner_wallet (partner_id),
  INDEX idx_partner_id (partner_id),
  INDEX idx_balance (balance)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: wallet_movements
-- =================================================================
CREATE TABLE IF NOT EXISTS `wallet_movements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `partner_id` INT NOT NULL,
  `movement_type` ENUM('carga', 'consumo', 'ajuste') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `balance_before` DECIMAL(12,2) NOT NULL,
  `balance_after` DECIMAL(12,2) NOT NULL,
  `description` TEXT,
  `reference_type` VARCHAR(50),
  `reference_id` INT,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_partner_id (partner_id),
  INDEX idx_movement_type (movement_type),
  INDEX idx_created_at (created_at),
  INDEX idx_created_by (created_by),
  INDEX idx_reference (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: wallet_validations
-- =================================================================
CREATE TABLE IF NOT EXISTS `wallet_validations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `validation_key` VARCHAR(100) UNIQUE NOT NULL,
  `validation_value` TEXT NOT NULL,
  `validation_type` ENUM('order_prefix', 'phone_pattern', 'min_balance', 'max_charge') NOT NULL,
  `partner_id` INT,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_validation_key (validation_key),
  INDEX idx_validation_type (validation_type),
  INDEX idx_partner_id (partner_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: customer_credit
-- =================================================================
CREATE TABLE IF NOT EXISTS `customer_credit` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_identification` VARCHAR(50) UNIQUE NOT NULL,
  `customer_name` VARCHAR(200) NOT NULL,
  `credit_limit` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `current_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `available_credit` DECIMAL(12,2) GENERATED ALWAYS AS (credit_limit - current_balance) STORED,
  `is_active` BOOLEAN DEFAULT TRUE,
  `last_purchase_date` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_identification (customer_identification),
  INDEX idx_customer_name (customer_name),
  INDEX idx_is_active (is_active),
  INDEX idx_available_credit (available_credit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: customer_credit_movements
-- =================================================================
CREATE TABLE IF NOT EXISTS `customer_credit_movements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_identification` VARCHAR(50) NOT NULL,
  `movement_type` ENUM('purchase', 'payment', 'adjustment') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `balance_before` DECIMAL(12,2) NOT NULL,
  `balance_after` DECIMAL(12,2) NOT NULL,
  `order_id` INT,
  `description` TEXT,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_customer_identification (customer_identification),
  INDEX idx_movement_type (movement_type),
  INDEX idx_order_id (order_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: packaging_checklist_items
-- =================================================================
CREATE TABLE IF NOT EXISTS `packaging_checklist_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(50),
  `is_mandatory` BOOLEAN DEFAULT TRUE,
  `display_order` INT DEFAULT 0,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_category (category),
  INDEX idx_is_active (is_active),
  INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: packaging_verifications
-- =================================================================
CREATE TABLE IF NOT EXISTS `packaging_verifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `checklist_item_id` INT NOT NULL,
  `is_verified` BOOLEAN DEFAULT FALSE,
  `verified_by` INT,
  `verified_at` TIMESTAMP NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (checklist_item_id) REFERENCES packaging_checklist_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_order_checklist (order_id, checklist_item_id),
  INDEX idx_order_id (order_id),
  INDEX idx_checklist_item_id (checklist_item_id),
  INDEX idx_is_verified (is_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: delivery_methods
-- =================================================================
CREATE TABLE IF NOT EXISTS `delivery_methods` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `requires_address` BOOLEAN DEFAULT TRUE,
  `requires_carrier` BOOLEAN DEFAULT FALSE,
  `is_active` BOOLEAN DEFAULT TRUE,
  `display_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_is_active (is_active),
  INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: siigo_credentials
-- =================================================================
CREATE TABLE IF NOT EXISTS `siigo_credentials` (
  `id` INT PRIMARY KEY DEFAULT 1,
  `username` VARCHAR(255) NOT NULL,
  `access_key` VARCHAR(500) NOT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `last_test_at` TIMESTAMP NULL,
  `last_test_status` ENUM('success', 'failed') NULL,
  `last_test_message` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: siigo_sync_log
-- =================================================================
CREATE TABLE IF NOT EXISTS `siigo_sync_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `siigo_invoice_id` VARCHAR(100),
  `sync_type` ENUM('webhook', 'manual', 'automatic') NOT NULL,
  `sync_status` ENUM('success', 'error', 'pending') DEFAULT 'pending',
  `order_id` INT NULL,
  `error_message` TEXT,
  `siigo_data` JSON,
  `processed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_siigo_invoice_id (siigo_invoice_id),
  INDEX idx_sync_status (sync_status),
  INDEX idx_sync_type (sync_type),
  INDEX idx_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: siigo_cache_invoices
-- =================================================================
CREATE TABLE IF NOT EXISTS `siigo_cache_invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `siigo_invoice_id` VARCHAR(100) UNIQUE NOT NULL,
  `invoice_number` VARCHAR(50),
  `invoice_date` DATE,
  `customer_name` VARCHAR(200),
  `total_amount` DECIMAL(12,2),
  `invoice_data` JSON,
  `last_synced_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_siigo_invoice_id (siigo_invoice_id),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_invoice_date (invoice_date),
  INDEX idx_customer_name (customer_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: siigo_import_logs
-- =================================================================
CREATE TABLE IF NOT EXISTS `siigo_import_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `import_type` ENUM('automatic', 'manual') NOT NULL,
  `import_status` ENUM('in_progress', 'completed', 'failed') NOT NULL,
  `invoices_found` INT DEFAULT 0,
  `invoices_imported` INT DEFAULT 0,
  `invoices_updated` INT DEFAULT 0,
  `invoices_failed` INT DEFAULT 0,
  `start_date` DATE,
  `end_date` DATE,
  `error_message` TEXT,
  `import_details` JSON,
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  `created_by` INT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_import_type (import_type),
  INDEX idx_import_status (import_status),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: whatsapp_notifications
-- =================================================================
CREATE TABLE IF NOT EXISTS `whatsapp_notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NULL,
  `phone_number` VARCHAR(20) NOT NULL,
  `message_type` ENUM('pedido_en_ruta', 'guia_envio', 'pedido_entregado', 'test', 'custom') NOT NULL,
  `message_content` TEXT NOT NULL,
  `image_url` VARCHAR(500),
  `wapify_message_id` VARCHAR(100),
  `status` ENUM('pendiente', 'enviado', 'entregado', 'fallido') DEFAULT 'pendiente',
  `sent_at` TIMESTAMP NULL,
  `delivered_at` TIMESTAMP NULL,
  `error_message` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_phone_number (phone_number),
  INDEX idx_message_type (message_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: shipping_companies
-- =================================================================
CREATE TABLE IF NOT EXISTS `shipping_companies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `is_active` BOOLEAN DEFAULT true,
  `guide_format_pattern` VARCHAR(100),
  `website_tracking_url` VARCHAR(500),
  `logo_url` VARCHAR(500),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_is_active (is_active),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: sender_configurations
-- =================================================================
CREATE TABLE IF NOT EXISTS `sender_configurations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_name` VARCHAR(100) NOT NULL,
  `company_nit` VARCHAR(50) NOT NULL,
  `address_line1` VARCHAR(200) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `country` VARCHAR(100) DEFAULT 'Colombia',
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `is_default` BOOLEAN DEFAULT true,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: manual_shipping_guides
-- =================================================================
CREATE TABLE IF NOT EXISTS `manual_shipping_guides` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `shipping_company_id` INT NOT NULL,
  `guide_number` VARCHAR(100) NOT NULL,
  `guide_image_url` VARCHAR(500) NOT NULL,
  `payment_type` ENUM('contraentrega', 'contado') NOT NULL,
  `package_weight` DECIMAL(8,2) NOT NULL,
  `package_dimensions` VARCHAR(100),
  `package_content` TEXT NOT NULL,
  `declared_value` DECIMAL(10,2) NOT NULL,
  `shipping_cost` DECIMAL(10,2) DEFAULT 0,
  `special_observations` TEXT,
  `sender_info` JSON NOT NULL,
  `recipient_info` JSON NOT NULL,
  `tracking_url` VARCHAR(500),
  `current_status` ENUM('generada', 'en_transito', 'entregada', 'devuelta') DEFAULT 'generada',
  `created_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (shipping_company_id) REFERENCES shipping_companies(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_order_id (order_id),
  INDEX idx_shipping_company_id (shipping_company_id),
  INDEX idx_guide_number (guide_number),
  INDEX idx_current_status (current_status),
  INDEX idx_created_by_user_id (created_by_user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- TABLA: activity_logs
-- =================================================================
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `action` VARCHAR(50) NOT NULL,
  `table_name` VARCHAR(50) NOT NULL,
  `record_id` INT,
  `old_values` JSON,
  `new_values` JSON,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_table_name (table_name),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- INSERTAR DATOS INICIALES
-- =================================================================

-- Usuarios por defecto (las contraseñas deben ser hasheadas con bcrypt)
INSERT INTO `users` (`username`, `email`, `password`, `role`, `full_name`, `active`) VALUES
('admin', 'admin@empresa.com', '$2a$10$YourHashedPasswordHere', 'admin', 'Administrador del Sistema', TRUE),
('facturador1', 'facturador@empresa.com', '$2a$10$YourHashedPasswordHere', 'facturador', 'Juan Pérez - Facturador', TRUE),
('cartera1', 'cartera@empresa.com', '$2a$10$YourHashedPasswordHere', 'cartera', 'María García - Cartera', TRUE),
('logistica1', 'logistica@empresa.com', '$2a$10$YourHashedPasswordHere', 'logistica', 'Carlos López - Logística', TRUE),
('empacador1', 'empacador@empresa.com', '$2a$10$YourHashedPasswordHere', 'empacador', 'Pedro Gómez - Empacador', TRUE),
('mensajero1', 'mensajero@empresa.com', '$2a$10$YourHashedPasswordHere', 'mensajero', 'Ana Rodríguez - Mensajero', TRUE)
ON DUPLICATE KEY UPDATE id=id;

-- Configuración de empresa
INSERT INTO `company_config` (`id`, `name`, `nit`, `legal_name`, `address`, `phone`, `email`) VALUES
(1, 'PERLAS EXPLOSIVAS', '901745588', 'PERLAS EXPLOSIVAS COLOMBIA S.A.S', 
 'CALLE 50 # 31-48 BUENOS AIRES, Medellín, Antioquia', '315 0006559', 'COMERCIAL@PERLAS-EXPLOSIVAS.COM')
ON DUPLICATE KEY UPDATE id=id;

-- Configuración del sistema
INSERT INTO `system_config` (`config_key`, `config_value`, `config_type`, `description`) VALUES
('siigo_start_date', '2025-08-01', 'date', 'Fecha de inicio para importación de facturas SIIGO'),
('automatic_import_enabled', 'true', 'boolean', 'Habilitar importación automática de SIIGO'),
('automatic_import_interval', '300000', 'number', 'Intervalo de importación en milisegundos (5 minutos)'),
('max_items_per_page', '20', 'number', 'Máximo de items por página en listados'),
('order_number_prefix', 'PED-', 'string', 'Prefijo para números de pedido'),
('enable_whatsapp_notifications', 'true', 'boolean', 'Habilitar notificaciones por WhatsApp')
ON DUPLICATE KEY UPDATE config_key=config_key;

-- Métodos de entrega
INSERT INTO `delivery_methods` (`code`, `name`, `description`, `requires_address`, `requires_carrier`, `display_order`) VALUES
('recoge_bodega', 'Recoge en Bodega', 'Cliente recoge el pedido en nuestra bodega', FALSE, FALSE, 1),
('domicilio_ciudad', 'Domicilio en Ciudad', 'Entrega a domicilio dentro de la ciudad', TRUE, FALSE, 2),
('envio_nacional', 'Envío Nacional', 'Envío a través de transportadora nacional', TRUE, TRUE, 3),
('envio_internacional', 'Envío Internacional', 'Envío fuera del país', TRUE, TRUE, 4)
ON DUPLICATE KEY UPDATE code=code;

-- Transportadoras colombianas
INSERT INTO `carriers` (`name`, `code`, `is_active`) VALUES
('SERVIENTREGA', 'servientrega', TRUE),
('COORDINADORA', 'coordinadora', TRUE),
('INTERRAPIDÍSIMO', 'interrapidisimo', TRUE),
('ENVIA', 'envia', TRUE),
('TCC', 'tcc', TRUE),
('DEPRISA', 'deprisa', TRUE)
ON DUPLICATE KEY UPDATE code=code;

-- Transportadoras adicionales (27 en total)
INSERT INTO `shipping_companies` (`name`, `code`, `guide_format_pattern`, `website_tracking_url`, `is_active`) VALUES
('ENVÍA', 'envia', '^[A-Z0-9]{8,12}$', 'https://www.envia.com/seguimiento/{guide_number}', TRUE),
('SERVIENTREGA', 'servientrega', '^[A-Z0-9]{8,15}$', 'https://www.servientrega.com/rastro/rastro_remesas.php?codigo={guide_number}', TRUE),
('INTERRAPIDÍSIMO', 'interrapidisimo', '^\\d{10,12}$', 'https://www.interrapidisimo.com/rastreo?codigo={guide_number}', TRUE),
('TRANSPRENSA', 'transprensa', '^[A-Z0-9]{6,15}$', '', TRUE),
('MANESAR Y SERVIR', 'manesar', '^[A-Z0-9]{8,12}$', '', TRUE),
('TERMINAL', 'terminal', '^[A-Z0-9]{6,12}$', '', TRUE),
('TE-ENTREGO', 'te_entrego', '^[A-Z0-9]{8,15}$', 'https://www.te-entrego.com/rastreo/{guide_number}', TRUE),
('SAFERBO', 'saferbo', '^[A-Z0-9]{8,12}$', '', TRUE),
('COOTMOTOR', 'cootmotor', '^\\d{8,12}$', '', TRUE),
('J.E. S.A.S', 'je_sas', '^[A-Z0-9]{6,12}$', '', TRUE),
('ENVÍA-ENTREGA', 'envia_entrega', '^[A-Z0-9]{8,12}$', 'https://www.envia.com/seguimiento/{guide_number}', TRUE),
('COOTRANSSOL', 'cootranssol', '^[A-Z0-9]{8,12}$', '', TRUE),
('CARIBE CARGO', 'caribe_cargo', '^[A-Z0-9]{8,15}$', '', TRUE),
('COONORTE', 'coonorte', '^[A-Z0-9]{8,12}$', '', TRUE),
('SOTRASANVICENTE', 'sotrasanvicente', '^[A-Z0-9]{8,12}$', '', TRUE),
('COORDINADORA', 'coordinadora', '^\\d{10,15}$', 'https://www.coordinadora.com/portafolio-de-servicios/seguimiento-de-envios/?codigo={guide_number}', TRUE),
('EXPRESOS BRASILIA', 'expresos_brasilia', '^[A-Z0-9]{8,12}$', '', TRUE),
('BOLIVARIANO', 'bolivariano', '^[A-Z0-9]{8,15}$', 'https://www.expresobolivariano.com/rastreo/{guide_number}', TRUE),
('SOTRAPEÑOL', 'sotrapenol', '^[A-Z0-9]{8,12}$', '', TRUE),
('COPETRANS', 'copetrans', '^[A-Z0-9]{8,12}$', 'https://www.copetran.com.co/rastreo/{guide_number}', TRUE),
('SOTRARETIRO', 'sotraretiro', '^[A-Z0-9]{8,12}$', '', TRUE),
('FLOTA OCCIDENTAL', 'flota_occidental', '^[A-Z0-9]{8,12}$', '', TRUE),
('LIPSA', 'lipsa', '^[A-Z0-9]{8,12}$', '', TRUE),
('SATENA', 'satena', '^[A-Z0-9]{8,12}$', 'https://www.satena.com/rastreo/{guide_number}', TRUE),
('TRANSPORTADORA J.F', 'transportadora_jf', '^[A-Z0-9]{8,12}$', '', TRUE),
('Z-EXPRESS', 'z_express', '^[A-Z0-9]{8,12}$', '', TRUE),
('TRANSEGOVIA', 'transegovia', '^[A-Z0-9]{8,12}$', '', TRUE)
ON DUPLICATE KEY UPDATE code=code;

-- Configuración de remitente (PERLAS EXPLOSIVAS)
INSERT INTO `sender_configurations` (`company_name`, `company_nit`, `address_line1`, `city`, `department`, `phone`, `email`, `is_default`) VALUES
('PERLAS EXPLOSIVAS COLOMBIA S.A.S', '901745588', 'CALLE 50 # 31-48 BUENOS AIRES', 'Medellín', 'Antioquia', '315 0006559', 'COMERCIAL@PERLAS-EXPLOSIVAS.COM', TRUE)
ON DUPLICATE KEY UPDATE company_nit=company_nit;

-- Items del checklist de empaque
INSERT INTO `packaging_checklist_items` (`code`, `name`, `description`, `category`, `is_mandatory`, `display_order`) VALUES
('verificar_items', 'Verificar Items', 'Verificar que todos los items del pedido estén completos', 'verificacion', TRUE, 1),
('verificar_calidad', 'Verificar Calidad', 'Inspeccionar la calidad de los productos', 'verificacion', TRUE, 2),
('embalar_productos', 'Embalar Productos', 'Embalar correctamente los productos', 'empaque', TRUE, 3),
('etiquetar_paquete', 'Etiquetar Paquete', 'Colocar etiqueta con información del pedido', 'empaque', TRUE, 4),
('agregar_factura', 'Agregar Factura', 'Incluir factura dentro del paquete', 'documentacion', TRUE, 5),
('cerrar_paquete', 'Cerrar Paquete', 'Sellar correctamente el paquete', 'empaque', TRUE, 6),
('foto_evidencia', 'Foto de Evidencia', 'Tomar foto del paquete cerrado', 'documentacion', FALSE, 7)
ON DUPLICATE KEY UPDATE code=code;

-- =================================================================
-- NOTAS IMPORTANTES
-- =================================================================
-- 1. Las contraseñas en la tabla users deben ser hasheadas con bcrypt
--    Contraseñas por defecto:
--    - admin: admin123
--    - facturador1: facturador123
--    - cartera1: cartera123
--    - logistica1: logistica123
--    - empacador1: empacador123
--    - mensajero1: mensajero123
--
-- 2. Las credenciales de SIIGO deben insertarse en la tabla siigo_credentials
--    después de la instalación
--
-- 3. La configuración de WhatsApp (Wapify) debe configurarse en system_config
--
-- 4. Este script crea la estructura completa de la base de datos
--    consolidando todas las migraciones anteriores
--
-- =================================================================
