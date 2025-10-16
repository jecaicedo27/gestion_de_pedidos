/**
 * Set/Reset password for a given username to "mensajero123"
 * - Uses mysql2/promise and bcryptjs
 * - Ensures user is active
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './backend/.env' });

async function setUserPassword(username, newPassword) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log(`🔧 Reseteando contraseña para usuario "${username}"...`);

    const hash = await bcrypt.hash(newPassword, 10);

    const [res] = await connection.execute(
      'UPDATE users SET password = ?, active = 1 WHERE username = ?',
      [hash, username]
    );

    if (res.affectedRows > 0) {
      console.log(`✅ Contraseña actualizada para "${username}" -> ${newPassword}`);
    } else {
      console.log(`⚠️ Usuario "${username}" no encontrado. Creándolo...`);
      const [create] = await connection.execute(
        `INSERT INTO users (username, email, phone, password, role, active, full_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, `${username}@empresa.com`, '3000000000', hash, 'mensajero', 1, 'Mensajero']
      );
      if (create.affectedRows > 0) {
        console.log(`✅ Usuario "${username}" creado con contraseña ${newPassword}`);
      } else {
        console.log('❌ No se pudo crear el usuario');
        process.exitCode = 1;
      }
    }

    // Verificación rápida
    const [rows] = await connection.execute(
      'SELECT id, username, role, active FROM users WHERE username = ?',
      [username]
    );
    console.log('📋 Estado:', rows);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  // Default: julian -> mensajero123
  setUserPassword(process.argv[2] || 'julian', process.argv[3] || 'mensajero123');
}

module.exports = { setUserPassword };
