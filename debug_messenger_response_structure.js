const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

console.log('🔍 ANALIZANDO ESTRUCTURA DE RESPUESTA DE MENSAJEROS');
console.log('=================================================\n');

async function debugMessengerResponseStructure() {
  try {
    console.log('1️⃣ Verificando estructura completa de mensajeros en BD...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    });

    // Obtener todos los campos de los mensajeros
    const [messengers] = await connection.execute(
      'SELECT * FROM users WHERE role = ? AND active = ?',
      ['mensajero', 1]
    );

    console.log(`👥 Mensajeros encontrados: ${messengers.length}\n`);
    messengers.forEach((m, index) => {
      console.log(`📋 Mensajero ${index + 1}:`);
      Object.keys(m).forEach(key => {
        console.log(`   - ${key}: "${m[key]}"`);
      });
      console.log('');
    });

    await connection.end();

    console.log('2️⃣ Verificando campos específicos para construcción de nombres...');
    messengers.forEach((m, index) => {
      console.log(`👤 Mensajero ${index + 1}:`);
      console.log(`   - name: "${m.name || 'NULL'}"`);
      console.log(`   - last_name: "${m.last_name || 'NULL'}"`);
      console.log(`   - username: "${m.username || 'NULL'}"`);
      console.log(`   - full_name: "${m.full_name || 'NO EXISTE'}"`);
      
      // Simular lo que debería construir el frontend
      const constructedName = m.full_name || 
                              (m.name && m.last_name ? `${m.name} ${m.last_name}` : 
                               m.name || m.username || 'Mensajero sin nombre');
      console.log(`   - Nombre construido: "${constructedName}"`);
      console.log('');
    });

    console.log('3️⃣ Problema identificado:');
    console.log('❌ El frontend está buscando "full_name" que no existe');
    console.log('❌ Necesitamos construir el nombre completo en el frontend');
    console.log('❌ O modificar el backend para enviar "full_name"');
    console.log('');
    console.log('💡 Solución recomendada: Corregir el frontend para construir el nombre');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugMessengerResponseStructure().catch(console.error);
