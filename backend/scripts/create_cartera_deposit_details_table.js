#!/usr/bin/env node
/**
 * Crea la tabla `cartera_deposit_details` (cruce depósito <→ facturas)
 * y configura tolerancia en system_config.
 *
 * - cartera_deposit_details: relación N:N entre consignaciones y facturas (orders)
 * - system_config.cartera_deposit_tolerance: tolerancia en pesos para diferencia
 *   entre el monto consignado y la suma asignada a facturas (default 300).
 */
const { query } = require('../config/database');

(async () => {
  try {
    console.log('🛠  Creando tabla cartera_deposit_details si no existe...');
    await query(`
      CREATE TABLE IF NOT EXISTS cartera_deposit_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        deposit_id INT NOT NULL,
        order_id INT NOT NULL,
        assigned_amount DECIMAL(12,2) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_deposit_id (deposit_id),
        INDEX idx_order_id (order_id),
        CONSTRAINT fk_cdd_deposit FOREIGN KEY (deposit_id) REFERENCES cartera_deposits (id) ON DELETE CASCADE,
        CONSTRAINT fk_cdd_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, []);

    console.log('🛠  Insertando clave system_config.cartera_deposit_tolerance si no existe...');
    const tol = await query(
      `SELECT 1 FROM system_config WHERE config_key = 'cartera_deposit_tolerance' LIMIT 1`,
      []
    );
    if (!tol.length) {
      await query(
        `INSERT INTO system_config (config_key, config_value, description, updated_at)
         VALUES ('cartera_deposit_tolerance', '300', 'Tolerancia (COP) para diferencia entre consignación y suma asignada a facturas', NOW())`,
        []
      );
      console.log('✅ Tolerancia creada con valor 300');
    } else {
      console.log('ℹ️  Tolerancia existente, no se modifica');
    }

    console.log('✅ Migración completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración cartera_deposit_details:', error);
    process.exit(1);
  }
})();
