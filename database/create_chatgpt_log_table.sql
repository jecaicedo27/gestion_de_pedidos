-- Create table for ChatGPT processing logs
CREATE TABLE IF NOT EXISTS chatgpt_processing_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quotation_id INT NULL,
  request_type ENUM('text', 'image') NOT NULL DEFAULT 'text',
  input_content TEXT NOT NULL,
  chatgpt_response JSON NULL,
  tokens_used INT DEFAULT 0,
  processing_time_ms INT DEFAULT 0,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_quotation_id (quotation_id),
  INDEX idx_created_at (created_at),
  INDEX idx_success (success),
  INDEX idx_request_type (request_type),
  
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
