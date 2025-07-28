const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos',
  multipleStatements: true
};

async function runBarcodeSystemMigration() {
  let connection;
  
  try {
    // Crear conexión
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'create_barcode_system.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar las consultas
    console.log('🔄 Ejecutando migración del sistema de códigos de barras...');
    
    // Dividir por statements y ejecutar uno por uno para mejor control
    const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await connection.execute(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} ejecutado`);
        } catch (error) {
          // Ignorar errores de "table already exists" o "column already exists"
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_FIELDNAME' ||
              error.code === 'ER_DUP_KEYNAME') {
            console.log(`⚠️  Statement ${i + 1}: ${error.message} (ignorando)`);
          } else {
            console.error(`❌ Error en statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    // Verificar que las tablas se crearon correctamente
    console.log('\n🔍 Verificando tablas creadas...');
    
    const tables = ['product_barcodes', 'product_variants', 'siigo_barcode_mapping', 'barcode_scan_logs'];
    for (const table of tables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ Tabla ${table}: ${rows[0].count} registros`);
      } catch (error) {
        console.error(`❌ Error verificando tabla ${table}:`, error.message);
      }
    }

    // Verificar datos de ejemplo
    console.log('\n📊 Verificando datos de ejemplo...');
    try {
      const [products] = await connection.execute('SELECT COUNT(*) as count FROM product_barcodes');
      const [mappings] = await connection.execute('SELECT COUNT(*) as count FROM siigo_barcode_mapping');
      
      console.log(`✅ Productos con código de barras: ${products[0].count}`);
      console.log(`✅ Mapeos SIIGO creados: ${mappings[0].count}`);
      
      // Mostrar algunos ejemplos
      const [examples] = await connection.execute(`
        SELECT pb.product_name, pb.barcode, pb.internal_code 
        FROM product_barcodes pb 
        LIMIT 3
      `);
      
      console.log('\n📝 Ejemplos de productos:');
      examples.forEach(product => {
        console.log(`   ${product.product_name} → ${product.barcode} (${product.internal_code})`);
      });

    } catch (error) {
      console.error('❌ Error verificando datos:', error.message);
    }

    console.log('\n🎉 ¡Migración del sistema de códigos de barras completada exitosamente!');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Configura los códigos de barras reales de tus productos');
    console.log('   2. Mapea los productos de SIIGO con los códigos de barras');
    console.log('   3. Prueba el sistema de escaneo en el módulo de empaque');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runBarcodeSystemMigration();
}

module.exports = { runBarcodeSystemMigration };
