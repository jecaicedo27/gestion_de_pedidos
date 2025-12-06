#!/usr/bin/env node
/**
 * Crea la tabla `cartera_deposits` y configura base inicial en system_config.
 */
const { query } = require('../config/database');

(async () => {
  try {
    console.log('🛠  Creando tabla cartera_deposits si no existe...');
    await query(`
      CREATE TABLE IF NOT EXISTS cartera_deposits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        amount DECIMAL(12,2) NOT NULL,
        bank_name VARCHAR(100) NULL,
        reference_number VARCHAR(100) NULL,
        evidence_file VARCHAR(255) NULL,
        notes TEXT NULL,
        deposited_by INT NULL,
        deposited_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_deposited_at (deposited_at),
        INDEX idx_deposited_by (deposited_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, []);

    console.log('🛠  Insertando clave system_config.cartera_base_balance si no existe...');
    const exists = await query(
      `SELECT 1 FROM system_config WHERE config_key = 'cartera_base_balance' LIMIT 1`,
      []
    );
    if (!exists.length) {
      await query(
        `INSERT INTO system_config (config_key, config_value, description, updated_at)
         VALUES ('cartera_base_balance', '0', 'Saldo base inicial de caja de Cartera', NOW())`,
        []
      );
      console.log('✅ Clave creada con valor 0');
    } else {
      console.log('ℹ️  Clave existente, no se modifica');
    }

    console.log('✅ Migración completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración cartera_deposits:', error);
    process.exit(1);
  }
})();
