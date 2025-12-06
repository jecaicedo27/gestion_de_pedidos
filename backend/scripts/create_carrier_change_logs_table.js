/**
 * Crea la tabla de auditoría carrier_change_logs si no existe.
 * Estructura:
 *  - id (PK)
 *  - order_id (FK lógico a orders.id)
 *  - old_carrier_id (nullable)
 *  - new_carrier_id (required)
 *  - user_id (nullable, usuario que ejecuta el cambio)
 *  - reason (texto corto obligatorio)
 *  - created_at (timestamp)
 *
 * Índices por order_id y user_id para consultas comunes.
 */
const { query } = require('../config/database');

async function tableExists(table) {
  // Usar information_schema para consultas parametrizadas (SHOW no soporta execute/prepared)
  const rows = await query(
    `SELECT COUNT(*) AS cnt 
       FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
        AND table_name = ?`,
    [table]
  );
  return rows && rows[0] && Number(rows[0].cnt) > 0;
}

async function run() {
  const table = 'carrier_change_logs';
  console.log(`🔎 Verificando tabla ${table}...`);
  const exists = await tableExists(table);

  if (!exists) {
    console.log(`🛠️  Creando tabla ${table}...`);
    await query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        old_carrier_id INT NULL,
        new_carrier_id INT NOT NULL,
        user_id INT NULL,
        reason VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_${table}_order_id (order_id),
        INDEX idx_${table}_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log(`✅ Tabla ${table} creada`);
  } else {
    console.log(`✅ Tabla ${table} ya existe`);
  }

  console.log('📋 Mostrando estructura de la tabla:');
  const desc = await query(`DESCRIBE ${table}`);
  for (const r of desc) {
    console.log(` - ${r.Field} ${r.Type} ${r.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${r.Key ? `[${r.Key}]` : ''} ${r.Default != null ? `DEFAULT ${r.Default}` : ''}`);
  }

  console.log('🏁 Migración completada');
}

run().catch((err) => {
  console.error('❌ Error creando/verificando carrier_change_logs:', err.sqlMessage || err.message || err);
  process.exitCode = 1;
});
