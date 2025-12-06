/**
 * Crea la tabla `cartera_movements` para registrar movimientos manuales de caja:
 * - extra_income: ingresos extra recibidos en Cartera (opcionalmente vinculados a un pedido)
 * - withdrawal: retiros de efectivo (gasolina, peajes, oficina, etc.) con motivo
 * - adjustment: ajustes manuales (no obligatorio en primera fase)
 *
 * También configura umbral de aprobación para retiros en system_config:
 * - cartera_withdrawal_approval_threshold (COP), por defecto 200000
 *
 * Uso:
 *   node backend/scripts/create_cartera_movements_table.js
 */
const { query, poolEnd } = require('../config/database');

async function ensureTable() {
  console.log('🛠  Creando tabla cartera_movements si no existe...');
  await query(`
    CREATE TABLE IF NOT EXISTS cartera_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('extra_income','withdrawal','adjustment') NOT NULL,
      reason_code VARCHAR(64) NULL,
      reason_text VARCHAR(255) NULL,
      order_id INT NULL,
      amount DECIMAL(12,2) NOT NULL,
      evidence_file VARCHAR(255) NULL,
      notes TEXT NULL,
      registered_by INT NULL,
      approval_status ENUM('approved','pending','rejected') NOT NULL DEFAULT 'approved',
      approved_by INT NULL,
      approved_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_type (type),
      INDEX idx_order_id (order_id),
      INDEX idx_registered_by (registered_by),
      INDEX idx_status (approval_status),
      INDEX idx_created_at (created_at),
      CONSTRAINT fk_cm_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Tabla cartera_movements OK');
}

async function ensureConfig() {
  console.log('🛠  Asegurando system_config.cartera_withdrawal_approval_threshold...');
  const rows = await query(
    `SELECT config_value FROM system_config WHERE config_key = 'cartera_withdrawal_approval_threshold' LIMIT 1`,
    []
  );
  if (!rows.length) {
    await query(
      `INSERT INTO system_config (config_key, config_value, description, updated_at)
       VALUES ('cartera_withdrawal_approval_threshold', '200000', 'Umbral (COP) que requiere aprobación de admin para retiros de efectivo en Cartera', NOW())`,
      []
    );
    console.log('✅ Clave creada con valor por defecto 200000');
  } else {
    console.log(`ℹ️  Ya existe, valor actual: ${rows[0].config_value}`);
  }
}

(async () => {
  try {
    await ensureTable();
    await ensureConfig();
    console.log('\n🎯 Migración de movimientos de Cartera finalizada.');
  } catch (error) {
    console.error('❌ Error en migración cartera_movements:', error);
    process.exitCode = 1;
  } finally {
    try { if (typeof poolEnd === 'function') await poolEnd(); } catch (_) {}
  }
})();
