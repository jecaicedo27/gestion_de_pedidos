const { query } = require('./backend/config/database');

console.log('🔍 Verificando estructura de la tabla users...\n');

async function checkUsersTable() {
  try {
    // Mostrar estructura de la tabla users
    console.log('📋 Estructura de la tabla users:');
    const structure = await query('DESCRIBE users');
    console.table(structure);
    
    // Mostrar algunos usuarios
    console.log('\n👥 Usuarios en el sistema:');
    const users = await query('SELECT id, username, email, role FROM users LIMIT 10');
    console.table(users);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUsersTable();
