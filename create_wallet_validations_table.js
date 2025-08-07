const { query } = require('./backend/config/database');

const createWalletValidationsTable = async () => {
  try {
    console.log('💳 Creando tabla wallet_validations...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS wallet_validations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        payment_method VARCHAR(50),
        validation_type ENUM('approved', 'rejected') NOT NULL,
        payment_proof_image VARCHAR(255),
        payment_reference VARCHAR(100),
        payment_amount DECIMAL(15,2),
        payment_date DATE,
        bank_name VARCHAR(100),
        customer_credit_limit DECIMAL(15,2),
        customer_current_balance DECIMAL(15,2),
        credit_approved BOOLEAN DEFAULT FALSE,
        validation_status ENUM('approved', 'rejected', 'pending') DEFAULT 'pending',
        validation_notes TEXT,
        validated_by INT,
        validated_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_order_id (order_id),
        INDEX idx_validation_status (validation_status),
        INDEX idx_validated_at (validated_at)
      )
    `;
    
    await query(createTableQuery);
    console.log('✅ Tabla wallet_validations creada exitosamente');
    
    // Verificar estructura
    const structure = await query('DESCRIBE wallet_validations');
    console.log('📊 Estructura de wallet_validations:');
    structure.forEach(field => {
      console.log(`   - ${field.Field}: ${field.Type}`);
    });
    
    console.log('🎉 ¡Tabla wallet_validations lista!');
    
  } catch (error) {
    console.error('❌ Error creando tabla wallet_validations:', error);
  }
  
  process.exit(0);
};

createWalletValidationsTable();
