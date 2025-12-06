const { pool } = require('../config/database');

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('🔍 Ejecutando: SHOW COLUMNS FROM wallet_validations LIKE "payment_type"');
    const [rows] = await connection.query(
      "SHOW COLUMNS FROM wallet_validations LIKE 'payment_type'"
    );
    console.log('📌 Resultado:', rows);
    connection.release();
  } catch (err) {
    console.error('❌ Error inspeccionando schema:', err);
  } finally {
    process.exit(0);
  }
})();
