// Script para crear el usuario 'empacador' con rol empacador y clave 'empacador123'
// Uso: node backend/scripts/create_empacador_user.js

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function ensureUser() {
  const username = 'empacador';
  const passwordPlain = 'empacador123';
  const role = 'empacador';
  const fullName = 'Usuario Empacador';
  const email = 'empacador@local';

  const saltRounds = 10;
  const hashed = await bcrypt.hash(passwordPlain, saltRounds);

  // Verificar si existe
  const rows = await query('SELECT id, username, role, active FROM users WHERE username = ?', [username]);
  if (rows.length) {
    const u = rows[0];
    console.log(`Usuario ya existe (id=${u.id}, role=${u.role}). Actualizando contraseña, rol y activando...`);
    await query('UPDATE users SET password = ?, role = ?, active = 1, updated_at = NOW() WHERE id = ?', [hashed, role, u.id]);
    console.log('✔ Actualizado.');
    return;
  }

  // Crear nuevo
  await query(
    `INSERT INTO users (username, email, password, role, full_name, phone, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
    [username, email, hashed, role, fullName, null]
  );
  const [user] = await query('SELECT id, username, role FROM users WHERE username = ?', [username]);
  console.log('✔ Usuario creado:', user);
}

ensureUser()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error creando usuario empacador:', err); process.exit(1); });
