const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

console.log('🔧 REPARACIÓN FINAL: Nombres de mensajeros en dropdown');
console.log('======================================================\n');

async function fixMessengerNames() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev'
  });

  try {
    console.log('1️⃣ Verificando mensajeros existentes...');
    const [messengers] = await connection.execute(
      `SELECT id, username, email, full_name, role, active 
       FROM users 
       WHERE role = 'mensajero' AND active = 1`
    );

    console.log(`👥 Mensajeros encontrados: ${messengers.length}`);
    messengers.forEach((m, index) => {
      console.log(`   ${index + 1}. ID: ${m.id}, Username: "${m.username}", Full_name: "${m.full_name || 'VACÍO'}"`);
    });

    console.log('\n2️⃣ Reparando nombres vacíos...');
    
    for (const messenger of messengers) {
      if (!messenger.full_name || messenger.full_name.trim() === '') {
        let newFullName;
        
        // Crear nombre basado en username
        if (messenger.username === 'juan.mensajero') {
          newFullName = 'Juan Mensajero';
        } else if (messenger.username === 'julian.mensajero') {
          newFullName = 'Julian Mensajero';
        } else {
          // Capitalizar username como fallback
          newFullName = messenger.username
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }

        await connection.execute(
          'UPDATE users SET full_name = ? WHERE id = ?',
          [newFullName, messenger.id]
        );
        
        console.log(`✅ Actualizado mensajero ${messenger.id}: "${newFullName}"`);
      } else {
        console.log(`ℹ️  Mensajero ${messenger.id} ya tiene nombre: "${messenger.full_name}"`);
      }
    }

    console.log('\n3️⃣ Verificando resultado final...');
    const [updatedMessengers] = await connection.execute(
      `SELECT id, username, full_name, role, active 
       FROM users 
       WHERE role = 'mensajero' AND active = 1 
       ORDER BY full_name`
    );

    console.log(`🎉 Mensajeros finales: ${updatedMessengers.length}`);
    updatedMessengers.forEach((m, index) => {
      console.log(`   ${index + 1}. ID: ${m.id}, Nombre: "${m.full_name}"`);
    });

    console.log('\n4️⃣ Creando mensajeros adicionales si es necesario...');
    
    // Asegurar que tenemos al menos Juan y Julian
    const juanExists = updatedMessengers.some(m => m.full_name.includes('Juan'));
    const julianExists = updatedMessengers.some(m => m.full_name.includes('Julian'));

    if (!juanExists) {
      await connection.execute(
        `INSERT INTO users (username, password, email, role, full_name, active, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        ['juan.mensajero', '$2a$10$defaulthashedpassword', 'juan@empresa.com', 'mensajero', 'Juan Mensajero', 1]
      );
      console.log('✅ Creado mensajero: Juan Mensajero');
    }

    if (!julianExists) {
      await connection.execute(
        `INSERT INTO users (username, password, email, role, full_name, active, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        ['julian.mensajero', '$2a$10$defaulthashedpassword', 'julian@empresa.com', 'mensajero', 'Julian Mensajero', 1]
      );
      console.log('✅ Creado mensajero: Julian Mensajero');
    }

    console.log('\n5️⃣ Verificación final completa...');
    const [finalMessengers] = await connection.execute(
      `SELECT id, username, full_name 
       FROM users 
       WHERE role = 'mensajero' AND active = 1 
       ORDER BY full_name`
    );

    console.log(`🚀 Total de mensajeros activos: ${finalMessengers.length}`);
    finalMessengers.forEach((m, index) => {
      console.log(`   ${index + 1}. ID: ${m.id}, Nombre: "${m.full_name}"`);
    });

    console.log('\n✅ ¡REPARACIÓN COMPLETADA!');
    console.log('   Los nombres ahora aparecerán en el dropdown del frontend.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixMessengerNames().catch(console.error);
