const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function checkTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev'
  });

  try {
    console.log('🔍 Verificando estructura de la tabla orders...');
    const [orderColumns] = await connection.execute('DESCRIBE orders');
    console.log('Columnas de orders:');
    orderColumns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

    console.log('\n🔍 Verificando si existe la tabla messengers...');
    try {
      const [messengerColumns] = await connection.execute('DESCRIBE messengers');
      console.log('✅ Tabla messengers existe. Columnas:');
      messengerColumns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));
      
      // Verificar registros en messengers
      const [messengers] = await connection.execute('SELECT * FROM messengers');
      console.log(`\n📋 Registros en messengers: ${messengers.length}`);
      messengers.forEach(m => console.log(`- ID: ${m.id}, User ID: ${m.user_id || 'N/A'}, Name: ${m.name || 'N/A'}`));
    } catch (error) {
      console.log('❌ La tabla messengers no existe:', error.message);
    }

    console.log('\n🔍 Verificando foreign keys de orders...');
    const [foreignKeys] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
        AND TABLE_NAME = 'orders' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log('Foreign Keys de orders:');
    foreignKeys.forEach(fk => {
      console.log(`- ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTables().catch(console.error);
