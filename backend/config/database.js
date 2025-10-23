const mysql = require('mysql2/promise');
const path = require('path');
const dotenvPath = process.env.DOTENV_PATH || path.join(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // mysql2 valid option for initial connection timeout
  connectTimeout: 60000
};

if (process.env.DEBUG_DB) {
  const masked = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database,
    hasPass: !!dbConfig.password,
    passLen: (dbConfig.password || '').length
  };
  console.log('DEBUG_DB mysql config:', masked);
}
// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para probar la conexión
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL establecida correctamente');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    return false;
  }
};

// Función para ejecutar queries
const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error ejecutando query:', error);
    throw error;
  }
};

// Función para transacciones
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const poolEnd = async () => {
  try {
    await pool.end();
    console.log('✅ Pool de conexiones MySQL cerrado correctamente');
  } catch (err) {
    console.warn('⚠️ Error cerrando pool MySQL (ignorado):', err.message);
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  poolEnd
};
