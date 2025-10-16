const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

console.log('🔍 DIAGNÓSTICO: Problema con nombres de mensajeros en dropdown');
console.log('===========================================================\n');

async function debugMessengerNames() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev'
  });

  try {
    console.log('1️⃣ Verificando estructura de la tabla users...');
    const [columns] = await connection.execute('DESCRIBE users');
    console.log('Columnas de la tabla users:');
    columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

    console.log('\n2️⃣ Verificando mensajeros existentes (todos los campos)...');
    const [messengers] = await connection.execute(
      `SELECT id, username, email, role, active, 
              name, last_name, full_name, 
              created_at, updated_at
       FROM users 
       WHERE role = 'mensajero' AND active = 1`
    );

    console.log(`👥 Mensajeros encontrados: ${messengers.length}`);
    messengers.forEach((m, index) => {
      console.log(`\n   Mensajero ${index + 1}:`);
      console.log(`   - ID: ${m.id}`);
      console.log(`   - Username: "${m.username}"`);
      console.log(`   - Email: "${m.email}"`);
      console.log(`   - Name: "${m.name || 'NULL'}"`);
      console.log(`   - Last_name: "${m.last_name || 'NULL'}"`);
      console.log(`   - Full_name: "${m.full_name || 'NULL'}"`);
      console.log(`   - Active: ${m.active}`);
    });

    console.log('\n3️⃣ ANÁLISIS DEL PROBLEMA:');
    console.log('========================');
    
    const hasNameField = columns.some(col => col.Field === 'name');
    const hasLastNameField = columns.some(col => col.Field === 'last_name');
    const hasFullNameField = columns.some(col => col.Field === 'full_name');

    console.log(`Campo "name" existe: ${hasNameField ? '✅' : '❌'}`);
    console.log(`Campo "last_name" existe: ${hasLastNameField ? '✅' : '❌'}`);
    console.log(`Campo "full_name" existe: ${hasFullNameField ? '✅' : '❌'}`);

    if (messengers.length > 0) {
      const messenger = messengers[0];
      console.log('\n4️⃣ DIAGNÓSTICO DEL PROBLEMA:');
      
      if (hasFullNameField && !messenger.full_name) {
        console.log('🚨 PROBLEMA ENCONTRADO:');
        console.log('   - El controlador devuelve "full_name" pero está vacío');
        console.log('   - Los mensajeros tienen "name" y "last_name" separados');
        console.log('   - Necesitamos concatenar name + last_name en full_name');
        
        console.log('\n5️⃣ REPARANDO DATOS...');
        for (const m of messengers) {
          if (m.name && !m.full_name) {
            const fullName = `${m.name} ${m.last_name || ''}`.trim();
            await connection.execute(
              'UPDATE users SET full_name = ? WHERE id = ?',
              [fullName, m.id]
            );
            console.log(`✅ Actualizado mensajero ${m.id}: "${fullName}"`);
          }
        }
        
        console.log('\n6️⃣ Verificando reparación...');
        const [updatedMessengers] = await connection.execute(
          `SELECT id, username, name, last_name, full_name 
           FROM users 
           WHERE role = 'mensajero' AND active = 1`
        );
        
        updatedMessengers.forEach((m, index) => {
          console.log(`   ${index + 1}. ID: ${m.id}, Full_name: "${m.full_name}"`);
        });
        
      } else if (!hasFullNameField) {
        console.log('🚨 PROBLEMA ENCONTRADO:');
        console.log('   - La tabla no tiene campo "full_name"');
        console.log('   - El controlador necesita usar "name" y "last_name"');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

debugMessengerNames().catch(console.error);
