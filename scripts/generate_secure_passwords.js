const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Función para generar contraseña aleatoria segura
function generateSecurePassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  return password;
}

// Función para hashear contraseña
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Generar contraseñas para todos los usuarios
async function generateAllPasswords() {
  console.log('=== GENERADOR DE CONTRASEÑAS SEGURAS ===\n');
  console.log('⚠️  IMPORTANTE: Guarde estas contraseñas en un lugar seguro\n');
  
  const users = [
    { username: 'admin', role: 'Administrador' },
    { username: 'facturador1', role: 'Facturador' },
    { username: 'cartera1', role: 'Cartera' },
    { username: 'logistica1', role: 'Logística' },
    { username: 'empacador1', role: 'Empacador' },
    { username: 'mensajero1', role: 'Mensajero' }
  ];
  
  console.log('-- CONTRASEÑAS GENERADAS --\n');
  
  for (const user of users) {
    const password = generateSecurePassword();
    const hash = await hashPassword(password);
    
    console.log(`Usuario: ${user.username} (${user.role})`);
    console.log(`Contraseña: ${password}`);
    console.log(`Hash: ${hash}`);
    console.log('---');
  }
  
  console.log('\n-- SCRIPT SQL PARA ACTUALIZAR --\n');
  console.log('USE gestion_pedidos_dev;\n');
  
  for (const user of users) {
    const password = generateSecurePassword();
    const hash = await hashPassword(password);
    console.log(`-- ${user.username}: ${password}`);
    console.log(`UPDATE users SET password = '${hash}' WHERE username = '${user.username}';`);
  }
  
  console.log('\n-- NOTAS DE SEGURIDAD --');
  console.log('1. Ejecute el script SQL en su base de datos');
  console.log('2. Comparta las contraseñas con los usuarios de forma segura');
  console.log('3. Solicite a los usuarios que cambien su contraseña en el primer inicio de sesión');
  console.log('4. NO guarde este archivo con las contraseñas en texto plano');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generateAllPasswords()
    .then(() => {
      console.log('\n✅ Contraseñas generadas exitosamente');
    })
    .catch(error => {
      console.error('❌ Error:', error.message);
    });
}

module.exports = { generateSecurePassword, hashPassword };
