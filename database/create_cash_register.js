const { query } = require('../backend/config/database');

async function createCashRegisterTable() {
  try {
    console.log('🏦 Creando tabla de registro de caja...');

    // Crear tabla cash_register
    await query(`
      CREATE TABLE IF NOT EXISTS cash_register (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method ENUM('efectivo', 'transferencia', 'tarjeta_credito', 'pago_electronico') NOT NULL,
        delivery_method ENUM('recoge_bodega', 'recogida_tienda', 'envio_nacional', 'domicilio_ciudad', 'domicilio_nacional', 'envio_internacional') NOT NULL,
        registered_by INT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (registered_by) REFERENCES users(id),
        INDEX idx_payment_method (payment_method),
        INDEX idx_delivery_method (delivery_method),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Tabla cash_register creada exitosamente');

    // Verificar la estructura
    const structure = await query('DESCRIBE cash_register');
    console.log('📋 Estructura de la tabla cash_register:');
    console.table(structure);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando tabla cash_register:', error);
    process.exit(1);
  }
}

createCashRegisterTable();
