const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function testMessengerDropdown() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev'
  });

  try {
    console.log('🔍 PRUEBA SIMPLE - Verificando mensajeros para dropdown...\n');

    // Verificar mensajeros activos usando solo campos que existen
    const [messengers] = await connection.execute(`
      SELECT id, username, email, role, active
      FROM users 
      WHERE role = 'mensajero' AND active = 1
      ORDER BY username
    `);

    console.log(`📊 Total mensajeros activos: ${messengers.length}`);
    
    if (messengers.length === 0) {
      console.log('❌ NO HAY MENSAJEROS ACTIVOS - Los dropdowns estarán vacíos');
      return;
    }

    console.log('\n📋 Mensajeros disponibles para dropdown:');
    messengers.forEach((messenger, index) => {
      console.log(`   ${index + 1}. ID: ${messenger.id} - Username: "${messenger.username}"`);
    });

    // Simular el HTML que se generará
    console.log('\n🎨 HTML que se generará en los dropdowns:');
    messengers.forEach(messenger => {
      console.log(`   <option value="${messenger.id}">${messenger.username}</option>`);
    });

    // Verificar si hay pedidos de mensajería local pendientes
    const [localOrders] = await connection.execute(`
      SELECT id, order_number, transport_company, status, customer_name
      FROM orders 
      WHERE transport_company = 'Mensajería Local' 
        AND status = 'empacado'
      LIMIT 3
    `);

    console.log(`\n📦 Pedidos de Mensajería Local pendientes: ${localOrders.length}`);
    if (localOrders.length > 0) {
      localOrders.forEach(order => {
        console.log(`   📋 ${order.order_number} - ${order.customer_name}`);
      });
    }

    console.log('\n✅ RESUMEN:');
    if (messengers.length > 0) {
      console.log(`✓ ${messengers.length} mensajeros disponibles para asignar`);
      console.log('✓ Los dropdowns deberían mostrar sus usernames');
      console.log('✓ Frontend actualizado para usar solo campos existentes');
    } else {
      console.log('❌ Sin mensajeros disponibles - necesitas crear usuarios con role="mensajero"');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

testMessengerDropdown().catch(console.error);
