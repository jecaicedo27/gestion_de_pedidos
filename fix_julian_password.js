/**
 * Resetea la contraseña y el rol/estado del usuario mensajero "julian" (y fallback "julian_carrillo")
 * - password: password123 (bcrypt hash reutilizado)
 * - role: mensajero
 * - active: 1
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixJulianPassword() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('🔧 Reseteando credenciales para usuario(s) mensajero(s) "julian"...');
    console.log('================================================');

    // Hash para "password123" (bcrypt)
    const hashedPassword = '$2a$10$YjRzKXmPqJZ.tpDmPWvOZOxNDkyH0N1sMT5CKkfvNXJJYYxXHhWba';

    // Intentar actualizar "julian"
    console.log('\n1) Actualizando usuario "julian"...');
    const [resJulian] = await connection.execute(
      'UPDATE users SET password = ?, role = ?, active = 1 WHERE username = ?',
      [hashedPassword, 'mensajero', 'julian']
    );
    if (resJulian.affectedRows > 0) {
      console.log('✅ Usuario "julian" actualizado: password=password123, role=mensajero, active=1');
    } else {
      console.log('⚠️ Usuario "julian" no existe, se intentará crear...');
      // Crear si no existe
      const [createJulian] = await connection.execute(
        `INSERT INTO users (username, email, phone, password, role, active, full_name) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['julian', 'julian@empresa.com', '3000000016', hashedPassword, 'mensajero', 1, 'Julian Carrillo']
      );
      if (createJulian.affectedRows > 0) {
        console.log('✅ Usuario "julian" creado con password=password123, role=mensajero, active=1');
      }
    }

    // Intentar actualizar "julian_carrillo" como respaldo
    console.log('\n2) Actualizando usuario "julian_carrillo" (fallback)...');
    const [resJulianC] = await connection.execute(
      'UPDATE users SET password = ?, role = ?, active = 1 WHERE username = ?',
      [hashedPassword, 'mensajero', 'julian_carrillo']
    );
    if (resJulianC.affectedRows > 0) {
      console.log('✅ Usuario "julian_carrillo" actualizado: password=password123, role=mensajero, active=1');
    } else {
      console.log('ℹ️ Usuario "julian_carrillo" no existe o no fue actualizado (esto puede ser normal).');
    }

    // Verificación rápida
    console.log('\n3) Verificando estado de usuarios...');
    const [rows] = await connection.execute(
      `SELECT id, username, role, active FROM users WHERE username IN ('julian','julian_carrillo')`
    );
    rows.forEach(u => {
      console.log(`   - id=${u.id} username=${u.username} role=${u.role} active=${u.active}`);
    });

    console.log('\n✅ Finalizado: credenciales de "julian" preparadas para pruebas (password: password123).');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  fixJulianPassword();
}

module.exports = { fixJulianPassword };
