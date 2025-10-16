const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

async function testLogisticsMessengerDisplay() {
  let connection;
  
  try {
    console.log('===========================================');
    console.log('🧪 Probando corrección de visualización de mensajeros');
    console.log('===========================================\n');

    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    });

    // 1. Verificar directamente en BD el pedido de Ximena
    console.log('📊 Verificando en base de datos pedido FV-2-13199...');
    const [orderCheck] = await connection.execute(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.status,
        o.assigned_messenger_id,
        u.username as messenger_username,
        u.full_name as messenger_name
       FROM orders o
       LEFT JOIN users u ON o.assigned_messenger_id = u.id
       WHERE o.order_number = 'FV-2-13199'`,
      []
    );

    if (orderCheck.length > 0) {
      const order = orderCheck[0];
      console.log(`\n✅ Pedido encontrado en BD:`);
      console.log(`   - ID: ${order.id}`);
      console.log(`   - Cliente: ${order.customer_name}`);
      console.log(`   - Estado: ${order.status}`);
      console.log(`   - ID Mensajero asignado: ${order.assigned_messenger_id || 'NO ASIGNADO'}`);
      console.log(`   - Nombre Mensajero: ${order.messenger_name || order.messenger_username || 'SIN MENSAJERO'}`);
    }

    // 2. Simular llamada al endpoint de logística
    console.log('\n📡 Llamando al endpoint de logística...');
    
    // Primero necesitamos hacer login para obtener el token
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: '123456'
    });

    const token = loginResponse.data.token;
    console.log('✅ Token obtenido');

    // Llamar al endpoint de logística
    const logisticsResponse = await axios.get('http://localhost:3001/api/logistics/ready-for-delivery', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('\n📦 Pedidos listos para entrega recibidos:', logisticsResponse.data.data.totalReady);

    // Buscar el pedido de Ximena en la respuesta
    const allOrders = [];
    Object.values(logisticsResponse.data.data.groupedOrders).forEach(group => {
      allOrders.push(...group);
    });

    const ximenaOrder = allOrders.find(o => o.order_number === 'FV-2-13199');

    if (ximenaOrder) {
      console.log('\n🔍 Pedido FV-2-13199 en respuesta del API:');
      console.log(`   - Cliente: ${ximenaOrder.customer_name}`);
      console.log(`   - Estado: ${ximenaOrder.status}`);
      console.log(`   - ID Mensajero: ${ximenaOrder.assigned_messenger_id || 'NO MOSTRADO'}`);
      console.log(`   - Nombre Mensajero: ${ximenaOrder.messenger_name || ximenaOrder.messenger_username || 'NO MOSTRADO'}`);
      
      if (ximenaOrder.assigned_messenger_id && ximenaOrder.messenger_name) {
        console.log('\n✅ ¡CORRECCIÓN EXITOSA! El mensajero ahora se muestra correctamente');
      } else {
        console.log('\n⚠️  El mensajero aún no se muestra en la respuesta del API');
      }
    } else {
      console.log('\n⚠️  Pedido FV-2-13199 no encontrado en la respuesta del API');
      console.log('    Esto puede ser normal si el estado cambió');
    }

    // 3. Mostrar muestra de otros pedidos con mensajeros
    console.log('\n📋 Muestra de pedidos con mensajeros asignados:');
    const ordersWithMessengers = allOrders.filter(o => o.assigned_messenger_id);
    
    if (ordersWithMessengers.length > 0) {
      ordersWithMessengers.slice(0, 5).forEach(order => {
        console.log(`\n   📦 ${order.order_number}`);
        console.log(`      Cliente: ${order.customer_name}`);
        console.log(`      Mensajero: ${order.messenger_name || order.messenger_username} (ID: ${order.assigned_messenger_id})`);
      });
      console.log(`\n   Total con mensajeros: ${ordersWithMessengers.length} pedidos`);
    } else {
      console.log('   No hay pedidos con mensajeros asignados');
    }

    console.log('\n===========================================');
    console.log('✅ Prueba completada');
    console.log('===========================================');

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar prueba
testLogisticsMessengerDisplay();
