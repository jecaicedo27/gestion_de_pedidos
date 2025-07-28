const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  
  try {
    // Configuración de conexión
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos',
      multipleStatements: true
    });

    console.log('🔗 Conectado a MySQL');

    // Ejecutar migraciones paso a paso
    console.log('📝 Agregando columnas a la tabla orders...');
    
    // 1. Agregar columnas a orders
    await connection.execute(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS actual_payment_method ENUM('efectivo', 'transferencia') NULL COMMENT 'Método real de pago usado en contraentrega',
      ADD COLUMN IF NOT EXISTS payment_received_by_messenger DECIMAL(10,2) NULL COMMENT 'Monto recibido por el mensajero en efectivo',
      ADD COLUMN IF NOT EXISTS payment_confirmed_by_wallet BOOLEAN DEFAULT FALSE COMMENT 'Confirmación de cartera para transferencias',
      ADD COLUMN IF NOT EXISTS is_medellin_delivery BOOLEAN DEFAULT FALSE COMMENT 'Indica si es entrega en Medellín para contraentrega'
    `);
    console.log('✅ Columnas agregadas a orders');

    // 2. Crear tabla contraentrega_payments
    console.log('📝 Creando tabla contraentrega_payments...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contraentrega_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        expected_amount DECIMAL(10,2) NOT NULL,
        actual_payment_method ENUM('efectivo', 'transferencia') NULL,
        amount_received DECIMAL(10,2) NULL,
        received_by_messenger_id INT NULL,
        confirmed_by_wallet_user_id INT NULL,
        payment_date TIMESTAMP NULL,
        confirmation_date TIMESTAMP NULL,
        notes TEXT NULL,
        status ENUM('pending', 'received', 'confirmed', 'completed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (received_by_messenger_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (confirmed_by_wallet_user_id) REFERENCES users(id) ON DELETE SET NULL,
        
        INDEX idx_order_id (order_id),
        INDEX idx_status (status),
        INDEX idx_payment_date (payment_date)
      )
    `);
    console.log('✅ Tabla contraentrega_payments creada');

    // 3. Crear tabla messenger_cash_tracking
    console.log('📝 Creando tabla messenger_cash_tracking...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messenger_cash_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        messenger_id INT NOT NULL,
        order_id INT NULL,
        transaction_type ENUM('received', 'delivered') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT NULL,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (messenger_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
        
        INDEX idx_messenger_id (messenger_id),
        INDEX idx_transaction_date (transaction_date),
        INDEX idx_transaction_type (transaction_type)
      )
    `);
    console.log('✅ Tabla messenger_cash_tracking creada');

    // 4. Verificar resultados
    console.log('📊 Verificando resultados...');
    
    const [contraentregaOrders] = await connection.execute(
      "SELECT COUNT(*) as count FROM orders WHERE payment_method = 'contraentrega'"
    );
    
    const [contraentregaPayments] = await connection.execute(
      "SELECT COUNT(*) as count FROM contraentrega_payments"
    );
    
    const [activeMessengers] = await connection.execute(
      "SELECT COUNT(*) as count FROM users WHERE role = 'mensajero' AND active = 1"
    );

    console.log('📈 Resumen:');
    console.log(`   - Órdenes con contraentrega: ${contraentregaOrders[0].count}`);
    console.log(`   - Registros en contraentrega_payments: ${contraentregaPayments[0].count}`);
    console.log(`   - Mensajeros activos: ${activeMessengers[0].count}`);

    console.log('🎉 Migración completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = runMigration;
