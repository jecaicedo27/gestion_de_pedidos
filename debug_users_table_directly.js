const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkUsersTableDirectly() {
  console.log('🔍 === CONSULTANDO TABLA USERS DIRECTAMENTE ===\n');
  
  let connection;
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('✅ Conexión a base de datos establecida\n');

    // 1. Verificar estructura de la tabla users
    console.log('📋 1. ESTRUCTURA DE LA TABLA USERS:');
    const [tableStructure] = await connection.execute('DESCRIBE users');
    tableStructure.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? '(NOT NULL)' : '(NULL)'} ${column.Key ? `[${column.Key}]` : ''}`);
    });
    console.log('');

    // 2. Consultar TODOS los usuarios
    console.log('👥 2. TODOS LOS USUARIOS EN LA TABLA:');
    const [allUsers] = await connection.execute('SELECT id, username, email, role, full_name, phone, active, created_at FROM users ORDER BY id');
    
    if (allUsers.length === 0) {
      console.log('❌ NO HAY USUARIOS EN LA TABLA');
    } else {
      allUsers.forEach(user => {
        console.log(`   ID: ${user.id} | ${user.username} (${user.email}) | Rol: ${user.role} | Activo: ${user.active} | Nombre: ${user.full_name || 'N/A'}`);
      });
    }
    console.log('');

    // 3. Consultar específicamente mensajeros
    console.log('🚀 3. USUARIOS CON ROL "mensajero":');
    const [messengers] = await connection.execute("SELECT id, username, email, role, full_name, phone, active, created_at FROM users WHERE role = 'mensajero'");
    
    if (messengers.length === 0) {
      console.log('❌ NO HAY USUARIOS CON ROL "mensajero"');
    } else {
      messengers.forEach(user => {
        console.log(`   ✅ ID: ${user.id} | ${user.username} (${user.email}) | Activo: ${user.active} | Nombre: ${user.full_name || 'N/A'} | Teléfono: ${user.phone || 'N/A'}`);
      });
    }
    console.log('');

    // 4. Consultar mensajeros activos específicamente 
    console.log('⚡ 4. MENSAJEROS ACTIVOS (role="mensajero" AND active=true):');
    const [activeMessengers] = await connection.execute("SELECT id, username, email, role, full_name, phone, active, created_at FROM users WHERE role = 'mensajero' AND active = true");
    
    if (activeMessengers.length === 0) {
      console.log('❌ NO HAY MENSAJEROS ACTIVOS');
      
      // Verificar si hay mensajeros inactivos
      const [inactiveMessengers] = await connection.execute("SELECT id, username, email, role, full_name, phone, active, created_at FROM users WHERE role = 'mensajero' AND active = false");
      
      if (inactiveMessengers.length > 0) {
        console.log('\n⚠️  MENSAJEROS INACTIVOS ENCONTRADOS:');
        inactiveMessengers.forEach(user => {
          console.log(`   🔴 ID: ${user.id} | ${user.username} (${user.email}) | Nombre: ${user.full_name || 'N/A'}`);
        });
        console.log('\n💡 SOLUCIÓN: Activar mensajeros existentes con:');
        console.log(`   UPDATE users SET active = true WHERE role = 'mensajero';`);
      } else {
        console.log('\n💡 SOLUCIÓN: Crear un mensajero nuevo con:');
        console.log(`   INSERT INTO users (username, email, password, role, full_name, phone, active, created_at) VALUES 
   ('mensajero1', 'mensajero1@empresa.com', '$2b$10$hashed_password', 'mensajero', 'Carlos Pérez - Mensajero', '3001234567', true, NOW());`);
      }
    } else {
      console.log(`✅ ${activeMessengers.length} MENSAJEROS ACTIVOS ENCONTRADOS:`);
      activeMessengers.forEach(user => {
        console.log(`   🟢 ID: ${user.id} | ${user.username} (${user.email}) | Nombre: ${user.full_name || 'N/A'} | Teléfono: ${user.phone || 'N/A'}`);
      });
      
      console.log('\n🎯 ESTOS MENSAJEROS DEBERÍAN APARECER EN EL DROPDOWN');
    }

    // 5. Consultar roles únicos para debug
    console.log('\n🏷️  5. TODOS LOS ROLES EN LA TABLA:');
    const [roles] = await connection.execute("SELECT DISTINCT role, COUNT(*) as count FROM users GROUP BY role");
    roles.forEach(role => {
      console.log(`   - "${role.role}": ${role.count} usuarios`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔐 Conexión cerrada');
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkUsersTableDirectly();
}

module.exports = { checkUsersTableDirectly };
