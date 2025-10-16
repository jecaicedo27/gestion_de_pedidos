const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function checkUsersStructure() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev'
  });

  try {
    console.log('🔍 Verificando estructura REAL de la tabla users...');
    const [columns] = await connection.execute('DESCRIBE users');
    console.log('Columnas disponibles en users:');
    columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

    console.log('\n🔍 Verificando mensajeros con los campos correctos...');
    const [messengers] = await connection.execute(
      'SELECT id, username, email, role, active FROM users WHERE role = ? AND active = ?',
      ['mensajero', 1]
    );

    console.log(`👥 Mensajeros encontrados: ${messengers.length}`);
    messengers.forEach(m => {
      console.log(`   - ID: ${m.id}, Username: ${m.username}, Email: ${m.email}, Activo: ${m.active}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkUsersStructure().catch(console.error);
