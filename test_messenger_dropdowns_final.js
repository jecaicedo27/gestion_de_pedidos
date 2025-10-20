const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function testMessengerDropdowns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev'
  });

  try {
    console.log('🔍 PRUEBA FINAL - Verificando mensajeros disponibles...\n');

    // 1. Verificar estructura de usuarios
    console.log('1️⃣ Verificando estructura de tabla users...');
    const [columns] = await connection.execute('DESCRIBE users');
    const hasName = columns.find(col => col.Field === 'name');
    const hasLastName = columns.find(col => col.Field === 'last_name');
    const hasUsername = columns.find(col => col.Field === 'username');
    
    console.log(`   ✅ Campo 'name': ${hasName ? 'EXISTE' : 'NO EXISTE'}`);
    console.log(`   ✅ Campo 'last_name': ${hasLastName ? 'EXISTE' : 'NO EXISTE'}`);
    console.log(`   ✅ Campo 'username': ${hasUsername ? 'EXISTE' : 'NO EXISTE'}`);

    // 2. Verificar mensajeros activos
    console.log('\n2️⃣ Verificando mensajeros activos...');
    const [messengers] = await connection.execute(`
      SELECT id, name, last_name, username, email, role, active,
             CONCAT(COALESCE(name, ''), ' ', COALESCE(last_name, '')) as full_name
      FROM users 
      WHERE role = 'mensajero' AND active = 1
      ORDER BY name
    `);

    console.log(`   📊 Total mensajeros activos: ${messengers.length}`);
    
    if (messengers.length === 0) {
      console.log('   ❌ NO HAY MENSAJEROS ACTIVOS');
      return;
    }

    // 3. Mostrar detalles de cada mensajero
    console.log('\n3️⃣ Detalles de mensajeros (como aparecerán en dropdown):');
    messengers.forEach((messenger, index) => {
      const displayName = messenger.full_name?.trim() || messenger.name || messenger.username || `Usuario ${messenger.id}`;
      console.log(`   ${index + 1}. ID: ${messenger.id}`);
      console.log(`      👤 Nombre mostrado: "${displayName}"`);
      console.log(`      📧 Email: ${messenger.email}`);
      console.log(`      🔑 Username: ${messenger.username}`);
      console.log(`      ✅ Activo: ${messenger.active ? 'Sí' : 'No'}\n`);
    });

    // 4. Verificar pedidos de mensajería local
    console.log('4️⃣ Verificando pedidos de "Mensajería Local"...');
    const [localOrders] = await connection.execute(`
      SELECT id, order_number, transport_company, assigned_messenger, status, customer_name
      FROM orders 
      WHERE transport_company = 'Mensajería Local' 
        AND status IN ('empacado', 'listo_para_entrega')
      LIMIT 5
    `);

    console.log(`   📦 Pedidos de Mensajería Local encontrados: ${localOrders.length}`);
    
    if (localOrders.length > 0) {
      localOrders.forEach(order => {
        console.log(`      📋 ${order.order_number} - ${order.customer_name} (Estado: ${order.status})`);
      });
    } else {
      console.log('   ℹ️  No hay pedidos de Mensajería Local en estado empacado');
    }

    // 5. Simular respuesta del API
    console.log('\n5️⃣ Simulando respuesta del API /api/users?role=mensajero&active=true...');
    const apiResponse = {
      success: true,
      data: {
        users: messengers,
        total: messengers.length
      }
    };

    console.log('   📡 Respuesta simulada del API:');
    console.log('   {');
    console.log('     "success": true,');
    console.log('     "data": {');
    console.log(`       "users": [${messengers.length} mensajeros],`);
    console.log(`       "total": ${messengers.length}`);
    console.log('     }');
    console.log('   }');

    // 6. Verificar que el frontend puede procesar los datos
    console.log('\n6️⃣ Verificando procesamiento de datos para frontend...');
    const frontendData = messengers.map(messenger => ({
      id: messenger.id,
      displayName: messenger.full_name?.trim() || messenger.name || messenger.username || `Usuario ${messenger.id}`,
      username: messenger.username,
      email: messenger.email
    }));

    console.log('   🎨 Datos procesados para dropdown:');
    frontendData.forEach(item => {
      console.log(`      <option value="${item.id}">${item.displayName}</option>`);
    });

    console.log('\n✅ DIAGNÓSTICO COMPLETO');
    console.log('💡 Los dropdowns deberían mostrar:');
    frontendData.forEach(item => {
      console.log(`   • ${item.displayName} (ID: ${item.id})`);
    });

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  } finally {
    await connection.end();
  }
}

testMessengerDropdowns().catch(console.error);
