/*M!999999\- enable the sandbox mode */ 
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `table_name` varchar(50) NOT NULL,
  `record_id` int(11) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_table_name` (`table_name`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entity` varchar(60) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `action` varchar(60) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `meta` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_entity` (`entity`,`entity_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `barcode_scan_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT NULL,
  `barcode` varchar(100) NOT NULL,
  `product_found` tinyint(1) DEFAULT 0,
  `product_barcode_id` int(11) DEFAULT NULL,
  `scan_result` enum('success','not_found','already_verified','error') NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `scan_timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `product_barcode_id` (`product_barcode_id`),
  KEY `idx_barcode_scan` (`barcode`),
  KEY `idx_scan_date` (`scan_timestamp`),
  CONSTRAINT `barcode_scan_logs_ibfk_1` FOREIGN KEY (`product_barcode_id`) REFERENCES `product_barcodes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campaign_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `channel` enum('whatsapp','sms','email') NOT NULL,
  `status` enum('sent','delivered','failed','clicked','responded') NOT NULL,
  `metadata` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_campaign` (`campaign_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaigns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('broadcast','triggered') NOT NULL,
  `template_id` int(11) NOT NULL,
  `segment_id` int(11) DEFAULT NULL,
  `status` enum('draft','scheduled','running','paused','finished') NOT NULL DEFAULT 'draft',
  `scheduled_at` datetime DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `metadata` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_scheduled` (`scheduled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `carrier_change_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `old_carrier_id` int(11) DEFAULT NULL,
  `new_carrier_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_carrier_change_logs_order_id` (`order_id`),
  KEY `idx_carrier_change_logs_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `carriers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `contact_email` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cartera_base_changes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `previous_base` decimal(12,2) NOT NULL DEFAULT 0.00,
  `new_base` decimal(12,2) NOT NULL DEFAULT 0.00,
  `changed_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cartera_deposit_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `deposit_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `assigned_amount` decimal(12,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_deposit_id` (`deposit_id`),
  KEY `idx_order_id` (`order_id`),
  CONSTRAINT `fk_cdd_deposit` FOREIGN KEY (`deposit_id`) REFERENCES `cartera_deposits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cdd_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=169 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cartera_deposits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `amount` decimal(12,2) NOT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `reason_code` varchar(64) DEFAULT NULL,
  `reason_text` varchar(255) DEFAULT NULL,
  `evidence_file` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `siigo_closed` tinyint(1) NOT NULL DEFAULT 0,
  `siigo_closed_at` datetime DEFAULT NULL,
  `siigo_closed_by` int(11) DEFAULT NULL,
  `deposited_by` int(11) DEFAULT NULL,
  `deposited_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_deposited_at` (`deposited_at`),
  KEY `idx_deposited_by` (`deposited_by`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cartera_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('extra_income','withdrawal','adjustment') NOT NULL,
  `reason_code` varchar(64) DEFAULT NULL,
  `reason_text` varchar(255) DEFAULT NULL,
  `order_id` int(11) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `evidence_file` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `registered_by` int(11) DEFAULT NULL,
  `approval_status` enum('approved','pending','rejected') NOT NULL DEFAULT 'approved',
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_registered_by` (`registered_by`),
  KEY `idx_status` (`approval_status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_cm_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_closing_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `closing_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `order_number` varchar(50) NOT NULL,
  `payment_method` enum('cash','transfer','card','other') NOT NULL,
  `order_amount` decimal(10,2) NOT NULL,
  `collected_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `collection_status` enum('pending','collected','partial','not_collected') DEFAULT 'pending',
  `collection_notes` text DEFAULT NULL,
  `collected_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `closing_id` (`closing_id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_collection_status` (`collection_status`),
  CONSTRAINT `cash_closing_details_ibfk_1` FOREIGN KEY (`closing_id`) REFERENCES `messenger_cash_closings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cash_closing_details_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_deliveries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `messenger_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `delivered_to` int(11) NOT NULL COMMENT 'Usuario que recibió el efectivo',
  `delivery_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `reference_number` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `delivered_to` (`delivered_to`),
  KEY `idx_messenger_deliveries` (`messenger_id`),
  KEY `idx_delivery_date` (`delivery_date`),
  CONSTRAINT `cash_deliveries_ibfk_1` FOREIGN KEY (`messenger_id`) REFERENCES `users` (`id`),
  CONSTRAINT `cash_deliveries_ibfk_2` FOREIGN KEY (`delivered_to`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_register` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('efectivo','transferencia','tarjeta_credito','pago_electronico') NOT NULL,
  `delivery_method` enum('recoge_bodega','recogida_tienda','envio_nacional','domicilio_ciudad','domicilio_nacional','envio_internacional') NOT NULL,
  `registered_by` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('pending','collected','discrepancy') DEFAULT 'pending',
  `accepted_by` int(11) DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `accepted_amount` decimal(10,2) DEFAULT NULL,
  `acceptance_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `registered_by` (`registered_by`),
  KEY `idx_payment_method` (`payment_method`),
  KEY `idx_delivery_method` (`delivery_method`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`),
  KEY `fk_cash_register_accepted_by` (`accepted_by`),
  KEY `idx_accepted_at` (`accepted_at`),
  CONSTRAINT `cash_register_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cash_register_ibfk_2` FOREIGN KEY (`registered_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_cash_register_accepted_by` FOREIGN KEY (`accepted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `siigo_id` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `parent_category_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `siigo_id` (`siigo_id`),
  KEY `idx_siigo_id` (`siigo_id`),
  KEY `idx_name` (`name`),
  KEY `idx_active` (`is_active`),
  KEY `parent_category_id` (`parent_category_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`parent_category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_sync_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sync_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `categories_synced` int(11) DEFAULT 0,
  `categories_created` int(11) DEFAULT 0,
  `categories_updated` int(11) DEFAULT 0,
  `categories_deactivated` int(11) DEFAULT 0,
  `errors` int(11) DEFAULT 0,
  `sync_duration_ms` int(11) DEFAULT 0,
  `error_details` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `chatgpt_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `natural_language_order` text DEFAULT NULL,
  `chatgpt_request` text DEFAULT NULL,
  `chatgpt_response` text DEFAULT NULL,
  `quotation_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quotation_data`)),
  `status` enum('processing','success','error') DEFAULT 'processing',
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `chatgpt_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chatgpt_logs_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `chatgpt_processing_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quotation_id` int(11) DEFAULT NULL,
  `processing_session_id` varchar(100) DEFAULT NULL,
  `request_source` varchar(50) DEFAULT 'api',
  `request_type` enum('text','image') NOT NULL,
  `input_content` text NOT NULL,
  `chatgpt_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`chatgpt_response`)),
  `tokens_used` int(11) DEFAULT NULL,
  `processing_time_ms` int(11) DEFAULT NULL,
  `success` tinyint(1) DEFAULT 1,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_quotation_id` (`quotation_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_chatgpt_quotation_id` (`quotation_id`),
  KEY `idx_chatgpt_session_id` (`processing_session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `churn_risk` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `score` decimal(5,2) NOT NULL,
  `features_json` longtext DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_churn_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_config` (
  `id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(100) NOT NULL DEFAULT 'Mi Empresa',
  `logo_url` varchar(255) DEFAULT '',
  `primary_color` varchar(7) DEFAULT '#3B82F6',
  `secondary_color` varchar(7) DEFAULT '#1E40AF',
  `address` text DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `company_name` varchar(100) DEFAULT 'Mi Empresa',
  `nit` varchar(50) DEFAULT NULL,
  `whatsapp` varchar(20) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `credit_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(255) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `transaction_type` enum('charge','payment','adjustment') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `balance_before` decimal(15,2) NOT NULL,
  `balance_after` decimal(15,2) NOT NULL,
  `description` text DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `credit_transactions_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `credit_transactions_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_consents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `channel` enum('whatsapp','sms','email') NOT NULL,
  `scope` enum('transaccional','marketing','todos') NOT NULL,
  `opt_in_at` datetime DEFAULT NULL,
  `opt_out_at` datetime DEFAULT NULL,
  `source` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_consents` (`customer_id`,`channel`,`scope`),
  KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_credit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_nit` varchar(50) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `credit_limit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `current_balance` decimal(15,2) NOT NULL DEFAULT 0.00,
  `available_credit` decimal(15,2) GENERATED ALWAYS AS (`credit_limit` - `current_balance`) STORED,
  `status` enum('active','inactive','suspended') DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_nit` (`customer_nit`),
  KEY `idx_customer_nit` (`customer_nit`),
  KEY `idx_customer_name` (`customer_name`),
  KEY `idx_status` (`status`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `customer_credit_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_credit_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_credit_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `movement_type` enum('charge','payment','adjustment','credit_increase','credit_decrease') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `previous_balance` decimal(15,2) NOT NULL,
  `new_balance` decimal(15,2) NOT NULL,
  `description` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_credit` (`customer_credit_id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_movement_type` (`movement_type`),
  KEY `idx_created_at` (`created_at`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `customer_credit_movements_ibfk_1` FOREIGN KEY (`customer_credit_id`) REFERENCES `customer_credit` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_credit_movements_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `customer_credit_movements_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_interactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `channel` enum('whatsapp','sms','email','telefono','interno') NOT NULL,
  `direction` enum('incoming','outgoing') NOT NULL,
  `template_key` varchar(100) DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `metadata` longtext DEFAULT NULL,
  `status` enum('sent','delivered','failed','read','responded') DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_created` (`customer_id`,`created_at`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `rfm_recency` int(11) DEFAULT NULL,
  `rfm_frequency` int(11) DEFAULT NULL,
  `rfm_monetary` decimal(12,2) DEFAULT NULL,
  `rfm_segment` enum('champion','leal','potencial','en_riesgo','dormido','nuevo') DEFAULT NULL,
  `value_score` decimal(5,2) DEFAULT NULL,
  `risk_score` decimal(5,2) DEFAULT NULL,
  `avg_order_value` decimal(12,2) DEFAULT NULL,
  `returns_rate` decimal(5,2) DEFAULT NULL,
  `complaints_count` int(11) DEFAULT NULL,
  `last_order_at` datetime DEFAULT NULL,
  `attributes` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_profiles_customer` (`customer_id`),
  KEY `idx_rfm_segment` (`rfm_segment`),
  KEY `idx_risk_score` (`risk_score`),
  KEY `idx_value_score` (`value_score`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `siigo_id` varchar(100) NOT NULL,
  `document_type` varchar(20) NOT NULL,
  `identification` varchar(50) NOT NULL,
  `document` varchar(50) DEFAULT NULL,
  `check_digit` varchar(5) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `commercial_name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT 'Colombia',
  `email` varchar(255) DEFAULT NULL,
  `segment` varchar(50) DEFAULT 'Minorista',
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `siigo_id` (`siigo_id`),
  KEY `idx_identification` (`identification`),
  KEY `idx_name` (`name`),
  KEY `idx_siigo_id` (`siigo_id`),
  KEY `idx_active` (`active`),
  KEY `idx_customers_document` (`document`)
) ENGINE=InnoDB AUTO_INCREMENT=9548 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_financial_snapshots` (
  `date` date NOT NULL,
  `inventory_value` decimal(20,2) DEFAULT 0.00,
  `money_in_circulation` decimal(20,2) DEFAULT 0.00,
  `cash_in_hand` decimal(20,2) DEFAULT 0.00,
  `bank_balance` decimal(20,2) DEFAULT 0.00,
  `mercado_pago_balance` decimal(20,2) DEFAULT 0.00,
  `receivables` decimal(20,2) DEFAULT 0.00,
  `payables` decimal(20,2) DEFAULT 0.00,
  `total_equity` decimal(20,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_metrics` (
  `date` date NOT NULL,
  `chats_count` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `chats_start` int(11) DEFAULT 0,
  `chats_end` int(11) DEFAULT 0,
  `orders_manual_count` int(11) DEFAULT 0,
  PRIMARY KEY (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_evidence` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `messenger_id` int(11) NOT NULL,
  `photo_filename` varchar(255) NOT NULL,
  `photo_path` varchar(500) NOT NULL,
  `photo_size` int(11) DEFAULT NULL,
  `photo_type` varchar(50) DEFAULT NULL,
  `delivery_tracking_id` int(11) DEFAULT NULL,
  `evidence_type` enum('photo','signature','gps','note') NOT NULL,
  `file_path` varchar(500) DEFAULT NULL COMMENT 'Ruta del archivo para fotos/firmas',
  `gps_latitude` decimal(10,8) DEFAULT NULL,
  `gps_longitude` decimal(11,8) DEFAULT NULL,
  `gps_accuracy` decimal(5,2) DEFAULT NULL COMMENT 'Precisión en metros',
  `text_content` text DEFAULT NULL COMMENT 'Para notas de texto',
  `captured_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `description` text DEFAULT NULL,
  `taken_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `upload_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_evidence` (`order_id`),
  KEY `idx_messenger` (`messenger_id`),
  KEY `idx_type` (`evidence_type`),
  KEY `idx_captured_at` (`captured_at`),
  KEY `idx_tracking_evidence` (`delivery_tracking_id`),
  KEY `idx_messenger_evidence` (`messenger_id`),
  CONSTRAINT `delivery_evidence_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `delivery_evidence_ibfk_2` FOREIGN KEY (`messenger_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_delivery_evidence_tracking` FOREIGN KEY (`delivery_tracking_id`) REFERENCES `delivery_tracking` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=635 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_methods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_tracking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `messenger_id` int(11) NOT NULL,
  `assigned_at` timestamp NULL DEFAULT NULL,
  `accepted_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `started_delivery_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `failed_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `failure_reason` text DEFAULT NULL,
  `delivery_notes` text DEFAULT NULL,
  `payment_collected` decimal(10,2) DEFAULT 0.00,
  `delivery_fee_collected` decimal(10,2) DEFAULT 0.00,
  `payment_method` enum('efectivo','transferencia','tarjeta') DEFAULT NULL,
  `delivery_fee_payment_method` varchar(50) DEFAULT NULL,
  `delivery_latitude` decimal(10,8) DEFAULT NULL,
  `delivery_longitude` decimal(11,8) DEFAULT NULL,
  `trusted_delivery` tinyint(1) NOT NULL DEFAULT 0,
  `trusted_authorized_by` int(11) DEFAULT NULL,
  `trusted_note` varchar(255) DEFAULT NULL,
  `trusted_sla_until` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_by_user_id` int(11) DEFAULT NULL,
  `cancelled_reason` text DEFAULT NULL,
  `status_cancelled` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_order_messenger` (`order_id`,`messenger_id`),
  KEY `idx_messenger_status` (`messenger_id`,`assigned_at`),
  KEY `idx_delivery_date` (`delivered_at`),
  CONSTRAINT `delivery_tracking_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `delivery_tracking_ibfk_2` FOREIGN KEY (`messenger_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=340 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_zones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `coverage_area` text DEFAULT NULL,
  `base_delivery_cost` decimal(10,2) DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date DEFAULT NULL,
  `provider_name` varchar(255) DEFAULT NULL,
  `provider_invoice_number` varchar(100) DEFAULT NULL,
  `siigo_fc_number` varchar(100) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` date DEFAULT NULL,
  `source` varchar(50) DEFAULT NULL,
  `payment_status` enum('PAGADO','PENDIENTE') NOT NULL DEFAULT 'PAGADO',
  `siigo_status` enum('PENDIENTE','APLICADO') DEFAULT 'PENDIENTE',
  `siigo_rp_number` varchar(100) DEFAULT NULL,
  `category` varchar(100) NOT NULL DEFAULT 'OTROS',
  `cost_center` varchar(100) DEFAULT NULL,
  `concept` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `evidence_url` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_source` (`source`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `external_drivers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `plate` varchar(50) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_analysis_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `analysis_date` datetime DEFAULT current_timestamp(),
  `avg_daily_consumption` decimal(10,2) DEFAULT 0.00,
  `consumption_trend` varchar(20) DEFAULT 'stable',
  `suggested_qty` int(11) DEFAULT 0,
  `current_stock` int(11) DEFAULT 0,
  `days_until_stockout` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_product_date` (`product_id`,`analysis_date`),
  CONSTRAINT `inventory_analysis_history_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18394 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `journey_executions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `journey_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `state` enum('waiting','executing','paused','completed','cancelled') NOT NULL DEFAULT 'waiting',
  `step_index` int(11) NOT NULL DEFAULT 0,
  `last_event_at` datetime DEFAULT NULL,
  `metadata` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_journey_state` (`journey_id`,`state`),
  KEY `idx_customer_state` (`customer_id`,`state`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `journeys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `definition_json` longtext NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_journey_name` (`name`),
  KEY `idx_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `points` int(11) NOT NULL,
  `reason` enum('purchase','feedback','referral','adjustment') NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `meta` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_reason` (`reason`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_points` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `balance` int(11) NOT NULL DEFAULT 0,
  `level` enum('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loyalty_customer` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `manual_shipping_guides` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `shipping_company_id` int(11) NOT NULL,
  `guide_number` varchar(100) NOT NULL,
  `guide_image_url` varchar(500) NOT NULL,
  `payment_type` enum('contraentrega','contado') NOT NULL,
  `package_weight` decimal(8,2) NOT NULL,
  `package_dimensions` varchar(100) DEFAULT NULL,
  `package_content` text NOT NULL,
  `declared_value` decimal(10,2) NOT NULL,
  `shipping_cost` decimal(10,2) DEFAULT 0.00,
  `special_observations` text DEFAULT NULL,
  `sender_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`sender_info`)),
  `recipient_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`recipient_info`)),
  `tracking_url` varchar(500) DEFAULT NULL,
  `current_status` enum('generada','en_transito','entregada','devuelta') DEFAULT 'generada',
  `created_by_user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_shipping_company_id` (`shipping_company_id`),
  KEY `idx_guide_number` (`guide_number`),
  KEY `idx_current_status` (`current_status`),
  KEY `idx_created_by_user_id` (`created_by_user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `manual_shipping_guides_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manual_shipping_guides_ibfk_2` FOREIGN KEY (`shipping_company_id`) REFERENCES `shipping_companies` (`id`),
  CONSTRAINT `manual_shipping_guides_ibfk_3` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `manufacturer_reposition_evidences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `uploaded_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_order_id` (`order_id`),
  CONSTRAINT `manufacturer_reposition_evidences_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manufacturer_reposition_evidences_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `merchandise_reception_expected_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reception_id` int(11) NOT NULL,
  `item_code` varchar(100) DEFAULT NULL,
  `item_description` text DEFAULT NULL,
  `expected_quantity` int(11) NOT NULL,
  `scanned_quantity` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reception_id` (`reception_id`),
  CONSTRAINT `merchandise_reception_expected_items_ibfk_1` FOREIGN KEY (`reception_id`) REFERENCES `merchandise_receptions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `merchandise_reception_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reception_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `cost` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `reception_id` (`reception_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `merchandise_reception_items_ibfk_1` FOREIGN KEY (`reception_id`) REFERENCES `merchandise_receptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `merchandise_reception_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `merchandise_receptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `supplier` varchar(255) NOT NULL,
  `supplier_nit` varchar(50) DEFAULT NULL,
  `invoice_number` varchar(100) DEFAULT NULL,
  `invoice_file_path` varchar(500) DEFAULT NULL,
  `reception_notes` text DEFAULT NULL,
  `reception_status` enum('ok','faltante','sobrante') DEFAULT NULL,
  `status` enum('pendiente_recepcion','recepcionado','completado') DEFAULT 'pendiente_recepcion',
  `created_by` int(11) DEFAULT NULL,
  `received_by` int(11) DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messenger_adhoc_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `messenger_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` text DEFAULT NULL,
  `evidence_url` varchar(255) DEFAULT NULL,
  `status` enum('pending','collected','rejected') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `accepted_by` int(11) DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `messenger_id` (`messenger_id`),
  KEY `accepted_by` (`accepted_by`),
  CONSTRAINT `messenger_adhoc_payments_ibfk_1` FOREIGN KEY (`messenger_id`) REFERENCES `users` (`id`),
  CONSTRAINT `messenger_adhoc_payments_ibfk_2` FOREIGN KEY (`accepted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messenger_cash_closings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `messenger_id` int(11) NOT NULL,
  `closing_date` date NOT NULL,
  `expected_amount` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Monto esperado según pedidos',
  `declared_amount` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Monto declarado por el mensajero',
  `difference_amount` decimal(10,2) GENERATED ALWAYS AS (`declared_amount` - `expected_amount`) STORED,
  `status` enum('pending','partial','completed','discrepancy') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL COMMENT 'Usuario que aprobó el cierre',
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_messenger_date` (`messenger_id`,`closing_date`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_closing_date` (`closing_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `messenger_cash_closings_ibfk_1` FOREIGN KEY (`messenger_id`) REFERENCES `users` (`id`),
  CONSTRAINT `messenger_cash_closings_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messenger_cash_closure` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `messenger_id` int(11) NOT NULL,
  `closure_date` date NOT NULL,
  `total_deliveries` int(11) DEFAULT 0,
  `total_payment_collected` decimal(10,2) DEFAULT 0.00,
  `total_delivery_fees` decimal(10,2) DEFAULT 0.00,
  `total_cash_collected` decimal(10,2) DEFAULT 0.00,
  `status` enum('open','submitted','approved','paid') DEFAULT 'open',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `messenger_notes` text DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_messenger_date` (`messenger_id`,`closure_date`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_closure_date` (`closure_date`),
  KEY `idx_messenger_closures` (`messenger_id`,`closure_date`),
  CONSTRAINT `messenger_cash_closure_ibfk_1` FOREIGN KEY (`messenger_id`) REFERENCES `users` (`id`),
  CONSTRAINT `messenger_cash_closure_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messenger_cash_closure_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cash_closure_id` int(11) NOT NULL,
  `delivery_tracking_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `payment_collected` decimal(10,2) DEFAULT 0.00,
  `delivery_fee` decimal(10,2) DEFAULT 0.00,
  `payment_method` enum('efectivo','transferencia','tarjeta') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `idx_closure_details` (`cash_closure_id`),
  KEY `idx_tracking_details` (`delivery_tracking_id`),
  CONSTRAINT `messenger_cash_closure_details_ibfk_1` FOREIGN KEY (`cash_closure_id`) REFERENCES `messenger_cash_closure` (`id`),
  CONSTRAINT `messenger_cash_closure_details_ibfk_2` FOREIGN KEY (`delivery_tracking_id`) REFERENCES `delivery_tracking` (`id`),
  CONSTRAINT `messenger_cash_closure_details_ibfk_3` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `messenger_cash_summary` AS SELECT
 1 AS `messenger_id`,
  1 AS `messenger_name`,
  1 AS `pending_cash`,
  1 AS `pending_closing_days`,
  1 AS `last_closing_date` */;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messenger_deliveries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `messenger_id` int(11) NOT NULL,
  `assigned_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `pickup_address` text DEFAULT NULL,
  `delivery_address` text DEFAULT NULL,
  `estimated_delivery_time` datetime DEFAULT NULL,
  `actual_delivery_time` datetime DEFAULT NULL,
  `status` enum('asignado','en_ruta','entregado','fallido','devuelto') DEFAULT 'asignado',
  `payment_collected` decimal(10,2) DEFAULT 0.00,
  `payment_method_used` varchar(100) DEFAULT NULL,
  `delivery_notes` text DEFAULT NULL,
  `customer_signature` text DEFAULT NULL,
  `delivery_photo` text DEFAULT NULL,
  `commission_amount` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `assigned_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_messenger_deliveries_status` (`status`),
  KEY `idx_messenger_deliveries_date` (`assigned_date`),
  KEY `idx_messenger_deliveries_messenger` (`messenger_id`),
  CONSTRAINT `messenger_deliveries_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messenger_deliveries_ibfk_2` FOREIGN KEY (`messenger_id`) REFERENCES `messengers` (`id`),
  CONSTRAINT `messenger_deliveries_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messenger_performance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `messenger_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `total_deliveries` int(11) DEFAULT 0,
  `successful_deliveries` int(11) DEFAULT 0,
  `failed_deliveries` int(11) DEFAULT 0,
  `total_collected` decimal(10,2) DEFAULT 0.00,
  `total_commission` decimal(10,2) DEFAULT 0.00,
  `average_delivery_time` int(11) DEFAULT 0,
  `rating` decimal(3,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_messenger_date` (`messenger_id`,`date`),
  KEY `idx_messenger_performance_date` (`date`),
  CONSTRAINT `messenger_performance_ibfk_1` FOREIGN KEY (`messenger_id`) REFERENCES `messengers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `messenger_summary` AS SELECT
 1 AS `id`,
  1 AS `name`,
  1 AS `phone`,
  1 AS `email`,
  1 AS `transportation_type`,
  1 AS `is_active`,
  1 AS `can_collect_payments`,
  1 AS `commission_percentage`,
  1 AS `total_deliveries`,
  1 AS `completed_deliveries`,
  1 AS `total_collected`,
  1 AS `total_commission`,
  1 AS `zones_covered` */;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messenger_zones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `messenger_id` int(11) NOT NULL,
  `zone_id` int(11) NOT NULL,
  `is_preferred` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_messenger_zone` (`messenger_id`,`zone_id`),
  KEY `zone_id` (`zone_id`),
  CONSTRAINT `messenger_zones_ibfk_1` FOREIGN KEY (`messenger_id`) REFERENCES `messengers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messenger_zones_ibfk_2` FOREIGN KEY (`zone_id`) REFERENCES `delivery_zones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messengers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `identification` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `emergency_contact_name` varchar(255) DEFAULT NULL,
  `emergency_contact_phone` varchar(50) DEFAULT NULL,
  `transportation_type` enum('moto','bicicleta','carro','pie') DEFAULT 'moto',
  `delivery_zones` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `can_collect_payments` tinyint(1) DEFAULT 1,
  `commission_percentage` decimal(5,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `identification` (`identification`),
  KEY `created_by` (`created_by`),
  KEY `idx_messengers_active` (`is_active`),
  KEY `idx_messengers_phone` (`phone`),
  CONSTRAINT `messengers_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `action` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `product_code` varchar(100) DEFAULT NULL,
  `product_name` varchar(255) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL,
  `purchase_cost` decimal(10,2) DEFAULT NULL,
  `profit_amount` decimal(20,2) DEFAULT 0.00,
  `profit_percent` decimal(10,2) DEFAULT 0.00,
  `status` enum('active','replaced','cancelled') NOT NULL DEFAULT 'active',
  `replaced_from_item_id` int(11) DEFAULT NULL,
  `unit_price` decimal(10,2) DEFAULT NULL,
  `subtotal` decimal(12,2) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `invoice_line` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `discount_percent` decimal(5,2) DEFAULT 0.00 COMMENT 'Porcentaje de descuento desde SIIGO',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_name` (`name`),
  KEY `idx_order_items_product_code` (`product_code`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6767 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_packaging_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `packaging_status` enum('pending','in_progress','completed','requires_review') DEFAULT 'pending',
  `total_items` int(11) NOT NULL DEFAULT 0,
  `verified_items` int(11) NOT NULL DEFAULT 0,
  `started_by` int(11) DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_by` int(11) DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `packaging_notes` text DEFAULT NULL,
  `quality_check_passed` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_id` (`order_id`),
  KEY `started_by` (`started_by`),
  KEY `completed_by` (`completed_by`),
  KEY `idx_packaging_status` (`packaging_status`),
  KEY `idx_order_packaging_status` (`order_id`),
  CONSTRAINT `order_packaging_status_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_packaging_status_ibfk_2` FOREIGN KEY (`started_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_packaging_status_ibfk_3` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_number` varchar(50) NOT NULL,
  `invoice_code` varchar(50) DEFAULT NULL,
  `customer_name` varchar(100) NOT NULL,
  `customer_document` varchar(50) DEFAULT NULL,
  `commercial_name` varchar(500) DEFAULT NULL,
  `customer_phone` varchar(20) NOT NULL,
  `customer_address` text NOT NULL,
  `customer_email` varchar(100) DEFAULT NULL,
  `customer_department` varchar(100) DEFAULT NULL,
  `customer_city` varchar(100) DEFAULT NULL,
  `delivery_method` enum('domicilio','mensajeria_urbana','nacional','recoge_bodega') DEFAULT NULL,
  `sale_channel` varchar(50) DEFAULT 'regular',
  `payment_method` enum('efectivo','transferencia','tarjeta_credito','pago_electronico','cliente_credito','contraentrega','publicidad','reposicion','credito') DEFAULT 'efectivo',
  `payment_evidence_path` varchar(255) DEFAULT NULL,
  `is_service` tinyint(1) DEFAULT 0,
  `is_pending_payment_evidence` tinyint(1) DEFAULT 0,
  `shipping_payment_method` varchar(50) DEFAULT NULL COMMENT 'Método de pago para el envío (contado, contraentrega, etc.)',
  `status` enum('pendiente_por_facturacion','en_preparacion','listo_para_entrega','entregado','entregado_transportadora','entregado_cliente','pendiente_facturacion','revision_cartera','en_logistica','pendiente_empaque','en_empaque','empacado','listo','listo_para_recoger','en_reparto','enviado','entregado_bodega','cancelado','gestion_especial') DEFAULT 'pendiente_facturacion',
  `packaging_status` enum('not_started','in_progress','paused','blocked_faltante','blocked_novedad','completed','requires_review') DEFAULT 'not_started',
  `packaging_lock_user_id` bigint(20) unsigned DEFAULT NULL,
  `packaging_lock_heartbeat_at` datetime DEFAULT NULL,
  `packaging_lock_expires_at` datetime DEFAULT NULL,
  `packaging_lock_reason` varchar(255) DEFAULT NULL,
  `messenger_status` enum('assigned','delivered','pending_assignment','accepted','rejected','in_delivery','delivery_failed','returned_to_logistics','failed','returned','cancelled') DEFAULT NULL,
  `delivery_attempts` int(11) DEFAULT 0,
  `requires_payment` tinyint(1) DEFAULT 0,
  `payment_amount` decimal(10,2) DEFAULT 0.00,
  `paid_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `delivery_fee` decimal(10,2) DEFAULT 0.00,
  `delivery_fee_exempt` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Excepción: no cobrar domicilio aun si aplica por regla',
  `validation_status` enum('pending','approved','rejected') DEFAULT 'pending',
  `validation_notes` text DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `net_value` decimal(15,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `special_management_note` text DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `siigo_invoice_id` varchar(100) DEFAULT NULL,
  `siigo_invoice_number` varchar(100) DEFAULT NULL,
  `order_source` enum('manual','siigo_automatic') DEFAULT 'manual',
  `siigo_observations` text DEFAULT NULL,
  `siigo_invoice_created_at` datetime DEFAULT NULL,
  `parsing_status` enum('auto_success','needs_review','manual_corrected') DEFAULT 'auto_success',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `assigned_guide_id` int(11) DEFAULT NULL,
  `assigned_messenger_id` int(11) DEFAULT NULL,
  `delivery_notes` text DEFAULT NULL,
  `expected_delivery_date` datetime DEFAULT NULL,
  `siigo_payment_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`siigo_payment_info`)),
  `siigo_seller_id` int(11) DEFAULT NULL,
  `siigo_balance` decimal(15,2) DEFAULT NULL,
  `siigo_document_type` varchar(50) DEFAULT NULL,
  `siigo_stamp_status` varchar(50) DEFAULT NULL,
  `siigo_mail_status` varchar(50) DEFAULT NULL,
  `siigo_public_url` text DEFAULT NULL,
  `customer_identification` varchar(50) DEFAULT NULL,
  `customer_id_type` varchar(50) DEFAULT NULL,
  `siigo_customer_id` varchar(100) DEFAULT NULL,
  `customer_person_type` varchar(50) DEFAULT NULL,
  `customer_country` varchar(100) DEFAULT 'Colombia',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `carrier_id` int(11) DEFAULT NULL,
  `tracking_number` varchar(100) DEFAULT NULL,
  `logistics_notes` text DEFAULT NULL,
  `shipping_date` datetime DEFAULT NULL,
  `assigned_messenger` int(11) DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_by_user_id` int(11) DEFAULT NULL,
  `cancellation_reason` text DEFAULT NULL,
  `cancellation_prev_status` varchar(50) DEFAULT NULL,
  `cancellation_logistics_ack_at` datetime DEFAULT NULL,
  `cancellation_logistics_ack_by` int(11) DEFAULT NULL,
  `cash_collected` tinyint(1) DEFAULT 0 COMMENT 'Indica si se recolectó el efectivo',
  `cash_collected_at` timestamp NULL DEFAULT NULL,
  `cash_collected_by` int(11) DEFAULT NULL,
  `shipping_city` varchar(100) DEFAULT NULL,
  `electronic_payment_type` varchar(50) DEFAULT NULL,
  `electronic_payment_notes` varchar(255) DEFAULT NULL,
  `shipping_guide_generated` tinyint(1) NOT NULL DEFAULT 0,
  `shipping_guide_path` varchar(255) DEFAULT NULL,
  `transport_guide_url` varchar(255) DEFAULT NULL,
  `transport_guide_notes` text DEFAULT NULL,
  `siigo_closed` tinyint(1) NOT NULL DEFAULT 0,
  `siigo_closed_at` datetime DEFAULT NULL,
  `siigo_closed_by` int(11) DEFAULT NULL,
  `siigo_closure_method` enum('efectivo','transferencia','credito','reposicion','otros','mercadopago','pago_electronico','contraentrega','publicidad') DEFAULT NULL,
  `siigo_closure_note` varchar(255) DEFAULT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `manufacturer_reposition_completed` tinyint(1) DEFAULT 0,
  `manufacturer_reposition_completed_at` datetime DEFAULT NULL,
  `manufacturer_reposition_completed_by` int(11) DEFAULT NULL,
  `manufacturer_reposition_notes` text DEFAULT NULL,
  `product_evidence_photo` varchar(255) DEFAULT NULL COMMENT 'Foto del producto entregado (POS)',
  `payment_evidence_photo` varchar(255) DEFAULT NULL COMMENT 'Comprobante de pago (POS)',
  `cash_evidence_photo` varchar(255) DEFAULT NULL COMMENT 'Foto del efectivo recibido (POS)',
  `delivered_by` int(11) DEFAULT NULL COMMENT 'ID del usuario que marcó como entregado',
  `submitted_for_approval_at` timestamp NULL DEFAULT NULL COMMENT 'Fecha de envío a aprobación de cartera',
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `idx_order_number` (`order_number`),
  KEY `idx_invoice_code` (`invoice_code`),
  KEY `idx_customer_name` (`customer_name`),
  KEY `idx_customer_phone` (`customer_phone`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_delivery_date` (`delivery_date`),
  KEY `idx_delivery_method` (`delivery_method`),
  KEY `idx_payment_method` (`payment_method`),
  KEY `idx_siigo_invoice_id` (`siigo_invoice_id`),
  KEY `idx_order_source` (`order_source`),
  KEY `idx_parsing_status` (`parsing_status`),
  KEY `assigned_guide_id` (`assigned_guide_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_assigned_messenger` (`assigned_messenger`),
  KEY `idx_delivered_at` (`delivered_at`),
  KEY `idx_orders_messenger_status` (`messenger_status`),
  KEY `idx_orders_assigned_messenger` (`assigned_messenger_id`,`messenger_status`),
  KEY `idx_cash_collected` (`cash_collected`),
  KEY `cash_collected_by` (`cash_collected_by`),
  KEY `idx_orders_customer_document` (`customer_document`),
  KEY `idx_packaging_status` (`packaging_status`),
  KEY `idx_packaging_lock_expires_at` (`packaging_lock_expires_at`),
  KEY `idx_packaging_lock_user_id` (`packaging_lock_user_id`),
  KEY `idx_carrier_id` (`carrier_id`),
  KEY `idx_tracking_number` (`tracking_number`),
  KEY `idx_siigo_closed` (`siigo_closed`),
  KEY `fk_delivered_by` (`delivered_by`),
  CONSTRAINT `fk_delivered_by` FOREIGN KEY (`delivered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orders_assigned_messenger` FOREIGN KEY (`assigned_messenger_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `orders_ibfk_10` FOREIGN KEY (`assigned_guide_id`) REFERENCES `manual_shipping_guides` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`assigned_guide_id`) REFERENCES `manual_shipping_guides` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_5` FOREIGN KEY (`assigned_guide_id`) REFERENCES `manual_shipping_guides` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_6` FOREIGN KEY (`assigned_guide_id`) REFERENCES `manual_shipping_guides` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_7` FOREIGN KEY (`assigned_guide_id`) REFERENCES `manual_shipping_guides` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_8` FOREIGN KEY (`assigned_guide_id`) REFERENCES `manual_shipping_guides` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_9` FOREIGN KEY (`cash_collected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1336 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders_audit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `action` enum('CREATE','UPDATE','DELETE','RESTORE') NOT NULL,
  `siigo_invoice_number` varchar(100) DEFAULT NULL,
  `customer_name` varchar(100) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `packaging_checklists` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `required_quantity` decimal(10,3) NOT NULL,
  `required_unit` varchar(50) NOT NULL,
  `required_weight` decimal(10,3) DEFAULT NULL,
  `required_flavor` varchar(100) DEFAULT NULL,
  `required_size` varchar(50) DEFAULT NULL,
  `packed_quantity` decimal(10,3) DEFAULT NULL,
  `packed_weight` decimal(10,3) DEFAULT NULL,
  `packed_flavor` varchar(100) DEFAULT NULL,
  `packed_size` varchar(50) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `verification_notes` text DEFAULT NULL,
  `packed_by` int(11) DEFAULT NULL,
  `packed_at` timestamp NULL DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `packed_by` (`packed_by`),
  KEY `verified_by` (`verified_by`),
  KEY `idx_order_packaging` (`order_id`),
  KEY `idx_item_packaging` (`item_id`),
  KEY `idx_verification_status` (`is_verified`),
  CONSTRAINT `packaging_checklists_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `packaging_checklists_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `packaging_checklists_ibfk_3` FOREIGN KEY (`packed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `packaging_checklists_ibfk_4` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `packaging_evidence` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `photo_filename` varchar(255) NOT NULL,
  `photo_path` varchar(500) NOT NULL,
  `photo_size` int(11) DEFAULT NULL,
  `photo_type` varchar(100) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `taken_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1699 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `packaging_item_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `packed_quantity` decimal(10,3) DEFAULT NULL,
  `packed_weight` decimal(10,3) DEFAULT NULL,
  `packed_flavor` varchar(255) DEFAULT NULL,
  `packed_size` varchar(255) DEFAULT NULL,
  `verification_notes` text DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `verified_by` varchar(255) DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `scanned_count` int(11) DEFAULT NULL,
  `required_scans` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_item` (`order_id`,`item_id`),
  KEY `item_id` (`item_id`),
  CONSTRAINT `packaging_item_verifications_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `packaging_item_verifications_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16012 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `packaging_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_name` varchar(255) NOT NULL,
  `product_code` varchar(100) DEFAULT NULL,
  `standard_weight` decimal(10,3) DEFAULT NULL,
  `weight_unit` varchar(20) DEFAULT 'kg',
  `available_flavors` text DEFAULT NULL,
  `available_sizes` text DEFAULT NULL,
  `packaging_instructions` text DEFAULT NULL,
  `quality_checks` text DEFAULT NULL,
  `common_errors` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_product_name` (`product_name`),
  KEY `idx_product_code` (`product_code`),
  KEY `idx_active_templates` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_evidences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT current_timestamp(),
  `uploaded_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_order_id` (`order_id`),
  CONSTRAINT `payment_evidences_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_evidences_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=271 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `module` varchar(50) NOT NULL,
  `action` varchar(50) NOT NULL,
  `resource` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_module` (`module`),
  KEY `idx_action` (`action`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `postventa_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_type` varchar(100) NOT NULL,
  `payload` longtext DEFAULT NULL,
  `processed` tinyint(1) NOT NULL DEFAULT 0,
  `processed_at` datetime DEFAULT NULL,
  `retries` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_type_processed` (`event_type`,`processed`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_barcodes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_name` varchar(255) NOT NULL,
  `barcode` varchar(100) NOT NULL,
  `internal_code` varchar(50) DEFAULT NULL,
  `siigo_product_id` varchar(100) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `unit_weight` decimal(8,3) DEFAULT NULL,
  `standard_price` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `barcode` (`barcode`),
  KEY `idx_barcode` (`barcode`),
  KEY `idx_product_name` (`product_name`),
  KEY `idx_siigo_product` (`siigo_product_id`),
  KEY `idx_internal_code` (`internal_code`)
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_inventory_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `min_inventory_qty` int(11) NOT NULL DEFAULT 0,
  `pack_size` int(11) NOT NULL DEFAULT 1,
  `supplier` varchar(255) DEFAULT NULL,
  `suggested_order_qty` int(11) DEFAULT NULL,
  `last_analysis_date` datetime DEFAULT NULL,
  `abc_classification` enum('A','B','C') DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_id` (`product_id`),
  KEY `idx_product_id` (`product_id`),
  CONSTRAINT `product_inventory_config_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19179 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_barcode_id` int(11) NOT NULL,
  `variant_name` varchar(255) NOT NULL,
  `variant_value` varchar(255) NOT NULL,
  `barcode` varchar(100) NOT NULL,
  `additional_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`additional_info`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `barcode` (`barcode`),
  KEY `product_barcode_id` (`product_barcode_id`),
  KEY `idx_variant_barcode` (`barcode`),
  KEY `idx_variant_name` (`variant_name`),
  CONSTRAINT `product_variants_ibfk_1` FOREIGN KEY (`product_barcode_id`) REFERENCES `product_barcodes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `barcode` varchar(100) NOT NULL,
  `internal_code` varchar(50) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `standard_price` decimal(10,2) DEFAULT NULL,
  `purchasing_price` decimal(10,2) DEFAULT 0.00,
  `siigo_product_id` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `siigo_id` varchar(255) DEFAULT NULL COMMENT 'ID del producto en SIIGO',
  `available_quantity` int(11) DEFAULT 0 COMMENT 'Cantidad disponible desde SIIGO',
  `last_sync_at` timestamp NULL DEFAULT NULL COMMENT 'Última sincronización con SIIGO',
  `subcategory` varchar(100) DEFAULT NULL,
  `stock` int(11) DEFAULT 0 COMMENT 'Stock quantity for inventory management',
  `stock_updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `barcode` (`barcode`),
  KEY `idx_barcode` (`barcode`),
  KEY `idx_category` (`category`),
  KEY `idx_siigo_product_id` (`siigo_product_id`),
  KEY `idx_siigo_id` (`siigo_id`),
  KEY `idx_available_quantity` (`available_quantity`)
) ENGINE=InnoDB AUTO_INCREMENT=19915 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`userapp`@`localhost`*/ /*!50003 TRIGGER products_barcode_before_insert
BEFORE INSERT ON products
FOR EACH ROW
BEGIN
  SET NEW.barcode =
    CASE
      WHEN NEW.barcode IS NULL OR NEW.barcode = '' THEN NEW.barcode
      WHEN NEW.barcode REGEXP '^[0-9 ,\.]+$' THEN SUBSTRING_INDEX(REPLACE(REPLACE(TRIM(NEW.barcode), ' ', ''), ',', '.'), '.', 1)
      ELSE REPLACE(TRIM(NEW.barcode), ' ', '')
    END;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`userapp`@`localhost`*/ /*!50003 TRIGGER products_barcode_before_update
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
  SET NEW.barcode =
    CASE
      WHEN NEW.barcode IS NULL OR NEW.barcode = '' THEN NEW.barcode
      WHEN NEW.barcode REGEXP '^[0-9 ,\.]+$' THEN SUBSTRING_INDEX(REPLACE(REPLACE(TRIM(NEW.barcode), ' ', ''), ',', '.'), '.', 1)
      ELSE REPLACE(TRIM(NEW.barcode), ' ', '')
    END;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products_backup_023724` (
  `id` int(11) NOT NULL DEFAULT 0,
  `product_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `barcode` varchar(100) NOT NULL,
  `internal_code` varchar(50) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `standard_price` decimal(10,2) DEFAULT NULL,
  `siigo_product_id` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `siigo_id` varchar(255) DEFAULT NULL COMMENT 'ID del producto en SIIGO',
  `available_quantity` int(11) DEFAULT 0 COMMENT 'Cantidad disponible desde SIIGO',
  `last_sync_at` timestamp NULL DEFAULT NULL COMMENT 'Última sincronización con SIIGO',
  `subcategory` varchar(100) DEFAULT NULL,
  `stock` int(11) DEFAULT 0 COMMENT 'Stock quantity for inventory management',
  `stock_updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products_backup_133693` (
  `id` int(11) NOT NULL DEFAULT 0,
  `product_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `barcode` varchar(100) NOT NULL,
  `internal_code` varchar(50) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `standard_price` decimal(10,2) DEFAULT NULL,
  `siigo_product_id` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `siigo_id` varchar(255) DEFAULT NULL COMMENT 'ID del producto en SIIGO',
  `available_quantity` int(11) DEFAULT 0 COMMENT 'Cantidad disponible desde SIIGO',
  `last_sync_at` timestamp NULL DEFAULT NULL COMMENT 'Última sincronización con SIIGO',
  `subcategory` varchar(100) DEFAULT NULL,
  `stock` int(11) DEFAULT 0 COMMENT 'Stock quantity for inventory management',
  `stock_updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products_backup_977613` (
  `id` int(11) NOT NULL DEFAULT 0,
  `product_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `barcode` varchar(100) NOT NULL,
  `internal_code` varchar(50) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `standard_price` decimal(10,2) DEFAULT NULL,
  `siigo_product_id` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `siigo_id` varchar(255) DEFAULT NULL COMMENT 'ID del producto en SIIGO',
  `available_quantity` int(11) DEFAULT 0 COMMENT 'Cantidad disponible desde SIIGO',
  `last_sync_at` timestamp NULL DEFAULT NULL COMMENT 'Última sincronización con SIIGO',
  `subcategory` varchar(100) DEFAULT NULL,
  `stock` int(11) DEFAULT 0 COMMENT 'Stock quantity for inventory management',
  `stock_updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotation_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quotation_id` int(11) NOT NULL,
  `product_code` varchar(100) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `unit_price` decimal(15,2) DEFAULT NULL,
  `discount_percentage` decimal(5,2) DEFAULT 0.00,
  `tax_percentage` decimal(5,2) DEFAULT 0.00,
  `total_amount` decimal(15,2) DEFAULT NULL,
  `siigo_product_id` varchar(100) DEFAULT NULL,
  `processing_confidence` decimal(3,2) DEFAULT NULL,
  `manual_review_required` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_quotation_id` (`quotation_id`),
  KEY `idx_product_code` (`product_code`),
  CONSTRAINT `quotation_items_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quotation_number` varchar(50) DEFAULT NULL,
  `customer_id` int(11) NOT NULL,
  `siigo_customer_id` varchar(100) NOT NULL,
  `raw_request` text NOT NULL,
  `processed_request` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`processed_request`)),
  `status` enum('draft','processing','completed','error','sent') DEFAULT 'draft',
  `total_amount` decimal(15,2) DEFAULT 0.00,
  `siigo_quotation_id` varchar(100) DEFAULT NULL,
  `siigo_quotation_url` varchar(500) DEFAULT NULL,
  `processing_notes` text DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotation_number` (`quotation_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_quotation_number` (`quotation_number`),
  CONSTRAINT `quotations_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `quotations_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2602 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `referrals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `referrer_customer_id` int(11) NOT NULL,
  `referred_customer_id` int(11) DEFAULT NULL,
  `code` varchar(20) NOT NULL,
  `state` enum('generated','registered','first_purchase','rewarded','cancelled') NOT NULL DEFAULT 'generated',
  `reward_points` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_referral_code` (`code`),
  KEY `idx_referrer` (`referrer_customer_id`),
  KEY `idx_referred` (`referred_customer_id`),
  KEY `idx_state` (`state`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  `granted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `granted_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_permission` (`role_id`,`permission_id`),
  KEY `granted_by` (`granted_by`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_3` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_views` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `view_name` varchar(100) NOT NULL,
  `is_visible` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `custom_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom_config`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_view` (`role_id`,`view_name`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_view_name` (`view_name`),
  CONSTRAINT `role_views_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `color` varchar(20) DEFAULT '#6B7280',
  `icon` varchar(50) DEFAULT 'user',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_name` (`name`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `segment_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `segment_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `computed_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_segment_member` (`segment_id`,`customer_id`),
  KEY `idx_segment` (`segment_id`),
  KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `segments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `rule_json` longtext NOT NULL,
  `is_dynamic` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_segment_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sender_configurations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(100) NOT NULL,
  `company_nit` varchar(50) NOT NULL,
  `address_line1` varchar(200) NOT NULL,
  `city` varchar(100) NOT NULL,
  `department` varchar(100) NOT NULL,
  `country` varchar(100) DEFAULT 'Colombia',
  `phone` varchar(20) NOT NULL,
  `email` varchar(100) NOT NULL,
  `is_default` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_is_default` (`is_default`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipping_companies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `guide_format_pattern` varchar(100) DEFAULT NULL,
  `website_tracking_url` varchar(500) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `siigo_barcode_mapping` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `siigo_product_name` varchar(255) NOT NULL,
  `siigo_product_code` varchar(100) DEFAULT NULL,
  `barcode_id` int(11) NOT NULL,
  `confidence_score` decimal(3,2) DEFAULT 1.00,
  `mapping_type` enum('exact','fuzzy','manual') DEFAULT 'manual',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `barcode_id` (`barcode_id`),
  KEY `idx_siigo_name` (`siigo_product_name`),
  KEY `idx_siigo_code` (`siigo_product_code`),
  CONSTRAINT `siigo_barcode_mapping_ibfk_1` FOREIGN KEY (`barcode_id`) REFERENCES `product_barcodes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `siigo_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(255) DEFAULT NULL,
  `cache_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`cache_data`)),
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cache_key` (`cache_key`),
  KEY `idx_cache_key` (`cache_key`),
  KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `siigo_cities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `country_code` varchar(2) NOT NULL,
  `state_code` varchar(2) NOT NULL,
  `city_code` varchar(5) NOT NULL,
  `state_name` varchar(100) NOT NULL,
  `city_name` varchar(120) NOT NULL,
  `search_text` varchar(300) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_state_city` (`state_code`,`city_code`),
  KEY `idx_search_text` (`search_text`)
) ENGINE=InnoDB AUTO_INCREMENT=1124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `siigo_configurations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) NOT NULL,
  `config_value` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`),
  KEY `idx_config_key` (`config_key`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `siigo_credentials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) DEFAULT 1 COMMENT 'ID de la empresa (para multi-tenancy futuro)',
  `siigo_username` varchar(255) NOT NULL COMMENT 'Usuario de SIIGO API',
  `siigo_access_key` text NOT NULL COMMENT 'Access Key de SIIGO API (encriptado)',
  `siigo_base_url` varchar(255) DEFAULT 'https://api.siigo.com/v1' COMMENT 'URL base de SIIGO API',
  `webhook_secret` text DEFAULT NULL COMMENT 'Secret para validar webhooks de SIIGO',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT 'Si las credenciales están habilitadas',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL COMMENT 'Usuario que creó las credenciales',
  `updated_by` int(11) DEFAULT NULL COMMENT 'Usuario que actualizó las credenciales',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_company_siigo` (`company_id`),
  KEY `idx_company_enabled` (`company_id`,`is_enabled`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Credenciales de SIIGO por empresa';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `siigo_expenses_daily` (
  `date` date NOT NULL,
  `total_amount` decimal(15,2) DEFAULT 0.00,
  `details_json` longtext DEFAULT NULL,
  `last_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `siigo_income_daily` (
  `date` date NOT NULL,
  `total_amount` decimal(15,2) DEFAULT 0.00,
  `details_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details_json`)),
  `last_updated` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `siigo_sync_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `siigo_invoice_id` varchar(100) DEFAULT NULL,
  `sync_type` enum('webhook','manual','automatic','update') NOT NULL,
  `sync_status` enum('success','error','pending','updated') DEFAULT 'pending',
  `order_id` int(11) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `siigo_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`siigo_data`)),
  `processed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `idx_siigo_invoice_id` (`siigo_invoice_id`),
  KEY `idx_sync_status` (`sync_status`),
  KEY `idx_sync_type` (`sync_type`),
  KEY `idx_processed_at` (`processed_at`),
  CONSTRAINT `siigo_sync_log_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=184794 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `simple_barcode_scans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `barcode` varchar(255) NOT NULL,
  `scanned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `scan_number` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_item` (`order_id`,`item_id`),
  KEY `idx_barcode` (`barcode`)
) ENGINE=InnoDB AUTO_INCREMENT=10362 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_product_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `supplier_code` varchar(100) NOT NULL,
  `barcode` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_supplier_code` (`supplier_code`),
  KEY `idx_barcode` (`barcode`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `surveys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) DEFAULT NULL,
  `order_id` int(11) NOT NULL,
  `channel` enum('whatsapp','sms','email') NOT NULL,
  `nps` tinyint(4) DEFAULT NULL,
  `csat` tinyint(4) DEFAULT NULL,
  `ces` tinyint(4) DEFAULT NULL,
  `comment` longtext DEFAULT NULL,
  `attributes` longtext DEFAULT NULL,
  `sent_at` datetime NOT NULL,
  `responded_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_responded` (`responded_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sync_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `siigo_product_id` varchar(255) DEFAULT NULL,
  `sync_status` enum('updated','error','completed','failed') NOT NULL,
  `message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_siigo_product_id` (`siigo_product_id`),
  KEY `idx_sync_status` (`sync_status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status_date` (`sync_status`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) NOT NULL,
  `config_value` text NOT NULL,
  `description` text DEFAULT NULL,
  `data_type` enum('string','number','date','boolean','json') DEFAULT 'string',
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_config_key` (`config_key`),
  KEY `idx_data_type` (`data_type`),
  CONSTRAINT `system_config_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `system_config_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `channel` enum('whatsapp','sms','email') NOT NULL,
  `template_key` varchar(100) NOT NULL,
  `content` longtext NOT NULL,
  `variables` longtext DEFAULT NULL,
  `approved` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_template_key` (`template_key`),
  KEY `idx_channel` (`channel`),
  KEY `idx_approved` (`approved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_updates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `note` longtext DEFAULT NULL,
  `attachments` longtext DEFAULT NULL,
  `prev_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ticket` (`ticket_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) DEFAULT NULL,
  `order_id` int(11) DEFAULT NULL,
  `source` enum('nps','logistica','cartera','manual','otros') NOT NULL,
  `category` enum('entrega','producto','pago','atencion','otros') NOT NULL,
  `status` enum('nuevo','en_progreso','esperando_cliente','resuelto','escalado','cerrado') NOT NULL DEFAULT 'nuevo',
  `priority` enum('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  `sla_due_at` datetime DEFAULT NULL,
  `assignee_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_priority` (`priority`),
  KEY `idx_sla` (`sla_due_at`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `assigned_by` int(11) DEFAULT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_role` (`user_id`,`role_id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','facturador','cartera','logistica','mensajero','empacador','empaque') NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_validations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `payment_method` enum('efectivo','transferencia','pago_electronico','tarjeta_credito','cliente_credito') NOT NULL,
  `validation_type` enum('approved','rejected') NOT NULL,
  `payment_proof_image` varchar(500) DEFAULT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `payment_amount` decimal(15,2) DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `payment_type` enum('single','mixed') DEFAULT 'single',
  `transferred_amount` decimal(10,2) DEFAULT NULL,
  `cash_amount` decimal(10,2) DEFAULT NULL,
  `cash_proof_image` varchar(255) DEFAULT NULL,
  `customer_credit_limit` decimal(15,2) DEFAULT NULL,
  `customer_current_balance` decimal(15,2) DEFAULT NULL,
  `credit_approved` tinyint(1) DEFAULT 0,
  `validation_status` enum('approved','rejected','pending') DEFAULT 'pending',
  `validation_notes` text DEFAULT NULL,
  `validated_by` int(11) DEFAULT NULL,
  `validated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `validated_by` (`validated_by`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_validation_status` (`validation_status`),
  KEY `idx_validated_at` (`validated_at`),
  CONSTRAINT `wallet_validations_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `wallet_validations_ibfk_2` FOREIGN KEY (`validated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=569 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `webhook_id` varchar(255) DEFAULT NULL,
  `topic` varchar(255) NOT NULL,
  `company_key` varchar(255) DEFAULT NULL,
  `product_id` varchar(255) DEFAULT NULL,
  `siigo_product_id` varchar(255) DEFAULT NULL,
  `product_code` varchar(255) DEFAULT NULL,
  `old_stock` int(11) DEFAULT NULL,
  `new_stock` int(11) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `processed` tinyint(1) DEFAULT 0,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_webhook_logs_processed` (`processed`),
  KEY `idx_webhook_logs_siigo_product_id` (`siigo_product_id`),
  KEY `idx_webhook_logs_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `webhook_id` varchar(255) NOT NULL,
  `application_id` varchar(255) NOT NULL,
  `topic` varchar(255) NOT NULL,
  `url` varchar(500) NOT NULL,
  `company_key` varchar(255) DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `webhook_id` (`webhook_id`),
  KEY `idx_webhook_subscriptions_topic` (`topic`),
  KEY `idx_webhook_subscriptions_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT NULL,
  `phone_number` varchar(20) NOT NULL,
  `message_type` enum('pedido_en_ruta','guia_envio','pedido_entregado','test') NOT NULL,
  `message_content` text NOT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `wapify_message_id` varchar(100) DEFAULT NULL,
  `status` enum('pendiente','enviado','entregado','fallido') DEFAULT 'pendiente',
  `sent_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_phone_number` (`phone_number`),
  KEY `idx_message_type` (`message_type`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50001 DROP VIEW IF EXISTS `messenger_cash_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `messenger_cash_summary` AS select `u`.`id` AS `messenger_id`,`u`.`full_name` AS `messenger_name`,coalesce(sum(case when `mcc`.`status` in ('pending','partial','discrepancy') then `mcc`.`expected_amount` - coalesce(`cd`.`total_delivered`,0) else 0 end),0) AS `pending_cash`,count(distinct case when `mcc`.`status` in ('pending','partial') then `mcc`.`closing_date` end) AS `pending_closing_days`,max(`mcc`.`closing_date`) AS `last_closing_date` from ((`users` `u` left join `messenger_cash_closings` `mcc` on(`u`.`id` = `mcc`.`messenger_id`)) left join (select `cash_deliveries`.`messenger_id` AS `messenger_id`,sum(`cash_deliveries`.`amount`) AS `total_delivered` from `cash_deliveries` group by `cash_deliveries`.`messenger_id`) `cd` on(`u`.`id` = `cd`.`messenger_id`)) where `u`.`role` = 'mensajero' group by `u`.`id`,`u`.`full_name` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `messenger_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `messenger_summary` AS select `m`.`id` AS `id`,`m`.`name` AS `name`,`m`.`phone` AS `phone`,`m`.`email` AS `email`,`m`.`transportation_type` AS `transportation_type`,`m`.`is_active` AS `is_active`,`m`.`can_collect_payments` AS `can_collect_payments`,`m`.`commission_percentage` AS `commission_percentage`,count(`md`.`id`) AS `total_deliveries`,count(case when `md`.`status` = 'entregado' then 1 end) AS `completed_deliveries`,coalesce(sum(`md`.`payment_collected`),0) AS `total_collected`,coalesce(sum(`md`.`commission_amount`),0) AS `total_commission`,group_concat(distinct `dz`.`name` separator ',') AS `zones_covered` from (((`messengers` `m` left join `messenger_deliveries` `md` on(`m`.`id` = `md`.`messenger_id`)) left join `messenger_zones` `mz` on(`m`.`id` = `mz`.`messenger_id`)) left join `delivery_zones` `dz` on(`mz`.`zone_id` = `dz`.`id`)) group by `m`.`id`,`m`.`name`,`m`.`phone`,`m`.`email`,`m`.`transportation_type`,`m`.`is_active`,`m`.`can_collect_payments`,`m`.`commission_percentage` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
