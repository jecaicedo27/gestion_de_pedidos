const mysql = require('mysql2/promise');
require('dotenv').config();

async function createWalletTables() {
  let connection;
  
  try {
    // Crear conexión
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    });

    console.log('🔗 Conectado a la base de datos');

    // Crear tabla wallet_validations
    const createWalletValidationsTable = `
      CREATE TABLE IF NOT EXISTS wallet_validations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        payment_method ENUM('efectivo', 'transferencia', 'tarjeta_credito', 'cliente_credito') NOT NULL,
        validation_type ENUM('approved', 'rejected') NOT NULL DEFAULT 'approved',
        payment_proof_image VARCHAR(255),
        payment_reference VARCHAR(100),
        payment_amount DECIMAL(10,2),
        payment_date DATE,
        bank_name VARCHAR(100),
        customer_credit_limit DECIMAL(10,2),
        customer_current_balance DECIMAL(10,2),
        credit_approved BOOLEAN DEFAULT FALSE,
        validation_status ENUM('approved', 'rejected') NOT NULL DEFAULT 'approved',
        validation_notes TEXT,
        validated_by INT NOT NULL,
        validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (validated_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(createWalletValidationsTable);
    console.log('✅ Tabla wallet_validations creada exitosamente');

    // Agregar columna validation_status a orders si no existe
    try {
      const addValidationStatusColumn = `
        ALTER TABLE orders 
        ADD COLUMN validation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
      `;
      await connection.execute(addValidationStatusColumn);
      console.log('✅ Columna validation_status agregada a orders');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Columna validation_status ya existe en orders');
      } else {
        throw error;
      }
    }

    // Agregar columna validation_notes a orders si no existe
    try {
      const addValidationNotesColumn = `
        ALTER TABLE orders 
        ADD COLUMN validation_notes TEXT
      `;
      await connection.execute(addValidationNotesColumn);
      console.log('✅ Columna validation_notes agregada a orders');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Columna validation_notes ya existe en orders');
      } else {
        throw error;
      }
    }

    console.log('🎉 Todas las tablas y columnas creadas exitosamente');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

createWalletTables();
