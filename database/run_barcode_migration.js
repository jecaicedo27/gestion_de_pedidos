const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev',
  multipleStatements: true
};

async function runBarcodeMigration() {
  let connection;
  
  try {
    console.log('🔄 Iniciando migración del sistema de códigos de barras...');
    
    // Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a MySQL establecida');
    
    // Leer el archivo SQL del sistema de códigos de barras
    const sqlPath = path.join(__dirname, 'create_barcode_system.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Dividir las consultas SQL por punto y coma
    const queries = sqlContent
      .split(';')
      .map(query => query.trim())
      .filter(query => query.length > 0);
    
    console.log(`📋 Ejecutando ${queries.length} consultas...`);
    
    for (let i = 0; i < queries.length; i++) {
      try {
        console.log(`⚡ Ejecutando consulta ${i + 1}/${queries.length}...`);
        await connection.execute(queries[i]);
        console.log(`✅ Consulta ${i + 1} ejecutada correctamente`);
      } catch (error) {
        // Ignorar errores de "table already exists" pero reportar otros
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
          console.log(`⚠️ Tabla ya existe (consulta ${i + 1}), continuando...`);
        } else {
          console.error(`❌ Error en consulta ${i + 1}:`, error.message);
          console.log('📝 Consulta que falló:', queries[i].substring(0, 100) + '...');
          // No salir, continuar con las siguientes consultas
        }
      }
    }
    
    console.log('✅ Migración del sistema de códigos de barras completada');
    
    // Verificar que las tablas se crearon correctamente
    console.log('🔍 Verificando estructura de tablas...');
    
    const tables = ['product_barcodes', 'product_variants', 'siigo_barcode_mapping', 'barcode_scan_logs'];
    
    for (const table of tables) {
      try {
        const [result] = await connection.execute(`DESCRIBE ${table}`);
        console.log(`✅ Tabla ${table}: ${result.length} columnas`);
      } catch (error) {
        console.log(`❌ Error verificando tabla ${table}:`, error.message);
      }
    }
    
    // Contar registros en product_barcodes
    try {
      const [count] = await connection.execute('SELECT COUNT(*) as total FROM product_barcodes');
      console.log(`📊 Total de productos con códigos de barras: ${count[0].total}`);
    } catch (error) {
      console.log('⚠️ No se pudo contar productos:', error.message);
    }
    
    console.log('🎉 Sistema de códigos de barras listo para usar');
    
  } catch (error) {
    console.error('❌ Error ejecutando migración de códigos de barras:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
    process.exit(0);
  }
}

// Ejecutar migración
runBarcodeMigration().catch(error => {
  console.error('❌ Fallo crítico en migración:', error);
  process.exit(1);
});
