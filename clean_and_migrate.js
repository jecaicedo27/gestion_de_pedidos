const mysql = require('./backend/node_modules/mysql2/promise');
require('./backend/node_modules/dotenv').config({ path: './backend/.env' });

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

const dbName = process.env.DB_NAME || 'gestion_pedidos_dev';

async function cleanAndMigrate() {
  let connection;
  
  try {
    console.log('🧹 Limpiando base de datos existente...');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a MySQL establecida');
    
    // Eliminar la base de datos si existe
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    console.log(`✅ Base de datos '${dbName}' eliminada`);
    
    await connection.end();
    console.log('🔌 Conexión cerrada');
    
    // Ahora ejecutar la migración normal
    console.log('\n🚀 Ejecutando migración limpia...');
    const { runMigration } = require('./database/migrate.js');
    await runMigration();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar
cleanAndMigrate();
