const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev'
};

async function runLogisticsMigration() {
  let connection;
  
  try {
    console.log('🔗 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📄 Leyendo archivo de migración...');
    const sqlFile = path.join(__dirname, '../database/add_logistics_fields.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Dividir el contenido en statements individuales
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`🔄 Ejecutando ${statements.length} statements de migración...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`📝 Ejecutando statement ${i + 1}/${statements.length}...`);
          await connection.execute(statement);
          console.log(`✅ Statement ${i + 1} ejecutado exitosamente`);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️  Statement ${i + 1} ya existe, continuando...`);
          } else {
            console.error(`❌ Error en statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    // Verificar que las tablas y campos se crearon correctamente
    console.log('\n🔍 Verificando migración...');
    
    // Verificar campos en orders
    const [orderColumns] = await connection.execute(`
      SHOW COLUMNS FROM orders WHERE Field IN (
        'shipping_method', 'carrier_id', 'tracking_number', 
        'shipping_guide_generated', 'shipping_guide_path'
      )
    `);
    console.log(`✅ Campos de logística en orders: ${orderColumns.length}/5`);
    
    // Verificar tabla carriers
    const [carriersTable] = await connection.execute(`
      SHOW TABLES LIKE 'carriers'
    `);
    console.log(`✅ Tabla carriers: ${carriersTable.length > 0 ? 'Creada' : 'No encontrada'}`);
    
    // Verificar transportadoras insertadas
    const [carriersCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM carriers
    `);
    console.log(`✅ Transportadoras registradas: ${carriersCount[0].count}`);
    
    // Mostrar transportadoras disponibles
    const [carriers] = await connection.execute(`
      SELECT id, name, code, contact_phone FROM carriers WHERE active = TRUE
    `);
    
    console.log('\n📋 Transportadoras disponibles:');
    carriers.forEach(carrier => {
      console.log(`  ${carrier.id}. ${carrier.name} (${carrier.code}) - ${carrier.contact_phone}`);
    });
    
    console.log('\n🎉 Migración de logística completada exitosamente!');
    console.log('\n📦 Nuevas funcionalidades disponibles:');
    console.log('  ✅ Métodos de envío: Recoge bodega, Domicilio local, Nacional, Terminal, Aéreo');
    console.log('  ✅ Gestión de transportadoras');
    console.log('  ✅ Números de seguimiento');
    console.log('  ✅ Generación de guías de envío');
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la migración
runLogisticsMigration();
