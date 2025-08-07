const { query } = require('./backend/config/database');

const createWalletTables = async () => {
  try {
    console.log('💰 Creando tablas wallet...');
    
    // Tabla customer_credit
    const createCustomerCreditQuery = `
      CREATE TABLE IF NOT EXISTS customer_credit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_identification VARCHAR(50),
        credit_limit DECIMAL(15,2) DEFAULT 0.00,
        current_balance DECIMAL(15,2) DEFAULT 0.00,
        available_credit DECIMAL(15,2) DEFAULT 0.00,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_customer (customer_id)
      )
    `;
    
    await query(createCustomerCreditQuery);
    console.log('✅ Tabla customer_credit creada');
    
    // Tabla credit_transactions 
    const createCreditTransactionsQuery = `
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL,
        order_id INT,
        transaction_type ENUM('charge', 'payment', 'adjustment') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        balance_before DECIMAL(15,2) NOT NULL,
        balance_after DECIMAL(15,2) NOT NULL,
        description TEXT,
        reference_number VARCHAR(100),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_customer_id (customer_id),
        INDEX idx_order_id (order_id),
        INDEX idx_created_at (created_at)
      )
    `;
    
    await query(createCreditTransactionsQuery);
    console.log('✅ Tabla credit_transactions creada');
    
    // Insertar algunos clientes de crédito básicos
    console.log('👥 Insertando clientes de crédito básicos...');
    
    const insertCredits = `
      INSERT IGNORE INTO customer_credit (customer_id, customer_name, customer_identification, credit_limit, current_balance, available_credit) VALUES
      ('distribuciones-panadero', 'Distribuciones El Panadero', '811021031', 10000000.00, 0.00, 10000000.00),
      ('cliente-mayorista-1', 'Cliente Mayorista Premium', '900123456', 5000000.00, 0.00, 5000000.00),
      ('cliente-mayorista-2', 'Distribuidora Central', '900789123', 3000000.00, 0.00, 3000000.00)
    `;
    
    await query(insertCredits);
    console.log('✅ Clientes de crédito insertados');
    
    // Verificar
    const credits = await query('SELECT * FROM customer_credit WHERE active = TRUE');
    console.log('📊 Clientes de crédito activos:', credits.length);
    credits.forEach(c => console.log(`   - ${c.customer_name}: $${c.credit_limit.toLocaleString()}`));
    
    console.log('🎉 ¡Tablas wallet listas!');
    
  } catch (error) {
    console.error('❌ Error creando tablas wallet:', error);
  }
  
  process.exit(0);
};

createWalletTables();
