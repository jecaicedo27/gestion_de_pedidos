const { query } = require('../backend/config/database');
const bcrypt = require('bcrypt');

const createFacturadorUser = async () => {
  try {
    console.log('✅ Conectado a la base de datos');
    console.log('🔄 Verificando usuario facturador...');

    // Verificar si ya existe el usuario facturador
    const existingUser = await query('SELECT id, username, role FROM users WHERE username = ?', ['facturador1']);
    
    if (existingUser.length > 0) {
      console.log('⚠️  Usuario facturador1 ya existe:');
      console.log(`   - ID: ${existingUser[0].id}`);
      console.log(`   - Username: ${existingUser[0].username}`);
      console.log(`   - Role: ${existingUser[0].role}`);
      return;
    }

    // Crear usuario facturador
    const hashedPassword = await bcrypt.hash('facturador123', 10);
    
    const result = await query(`
      INSERT INTO users (
        username, password, email, full_name, role, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      'facturador1',
      hashedPassword,
      'facturador1@empresa.com',
      'Facturador Principal',
      'facturador',
      true
    ]);

    console.log('✅ Usuario facturador creado exitosamente:');
    console.log(`   - ID: ${result.insertId}`);
    console.log(`   - Username: facturador1`);
    console.log(`   - Password: facturador123`);
    console.log(`   - Role: facturador`);

    // Mostrar todos los usuarios para verificar
    const allUsers = await query('SELECT id, username, role, active FROM users ORDER BY role, username');
    
    console.log('\n📋 Usuarios en el sistema:');
    allUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.role}) - ${user.active ? 'Activo' : 'Inactivo'}`);
    });

  } catch (error) {
    console.error('❌ Error creando usuario facturador:', error);
    process.exit(1);
  }
};

// Ejecutar creación
createFacturadorUser()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  });
