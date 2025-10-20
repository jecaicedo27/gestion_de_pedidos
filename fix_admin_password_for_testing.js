const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function fixAdminPassword() {
  let connection;

  try {
    console.log('🔧 ARREGLAR CREDENCIALES DE ADMIN PARA TESTING\n');

    // Conectar a la base de datos
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Conectado a la base de datos');

    // Verificar usuario admin actual
    const [adminUsers] = await connection.execute(
      'SELECT id, username, full_name, email, role FROM users WHERE role = "admin"'
    );

    console.log('👤 Usuarios admin actuales:', adminUsers);

    if (adminUsers.length === 0) {
      throw new Error('No se encontraron usuarios admin');
    }

    // Usar el primer admin encontrado
    const adminUser = adminUsers[0];
    console.log(`\n📝 Actualizando contraseña para: ${adminUser.username}`);

    // Generar nueva contraseña que cumpla requisitos (mínimo 6 caracteres)
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la contraseña
    const [result] = await connection.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, adminUser.id]
    );

    console.log(`✅ Contraseña actualizada. Filas afectadas: ${result.affectedRows}`);
    console.log(`\n🔑 NUEVAS CREDENCIALES ADMIN:`);
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Email: ${adminUser.email}`);

    // Verificar que la actualización funcionó
    const [updatedUser] = await connection.execute(
      'SELECT id, username, full_name, email, role, password FROM users WHERE id = ?',
      [adminUser.id]
    );

    if (updatedUser.length > 0) {
      console.log(`\n✅ Verificación exitosa. Usuario actualizado correctamente.`);
      
      // Test rápido de bcrypt
      const passwordMatch = await bcrypt.compare(newPassword, updatedUser[0].password);
      console.log(`🔐 Test de hash: ${passwordMatch ? 'CORRECTO' : 'ERROR'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
fixAdminPassword();
