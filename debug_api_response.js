const fetch = require('node-fetch');

async function debugAPIResponse() {
  try {
    console.log('🔍 Debugeando respuesta de API para mensajeros...\n');
    
    // 1. Login como mensajero
    console.log('1. 🔐 Logueando como mensajero...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mensajero1',
        password: 'mensajero123'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Error login mensajero');
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.data?.token;
    console.log('✅ Mensajero logueado exitosamente');
    
    // 2. Obtener pedidos desde API como mensajero
    console.log('\n2. 📡 Obteniendo pedidos desde API /api/orders...');
    const ordersResponse = await fetch('http://localhost:3001/api/orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ordersResponse.ok) {
      console.log('❌ Error obteniendo pedidos:', ordersResponse.status);
      const errorText = await ordersResponse.text();
      console.log('Error details:', errorText);
      return;
    }
    
    const ordersData = await ordersResponse.json();
    console.log('✅ Respuesta recibida');
    
    // 3. Analizar la estructura de respuesta
    console.log('\n3. 📊 ANALIZANDO ESTRUCTURA DE RESPUESTA:');
    console.log(`Estructura de respuesta:`, Object.keys(ordersData));
    
    let orders = [];
    if (ordersData.data?.orders) {
      orders = ordersData.data.orders;
    } else if (ordersData.orders) {
      orders = ordersData.orders;
    } else if (Array.isArray(ordersData.data)) {
      orders = ordersData.data;
    } else if (Array.isArray(ordersData)) {
      orders = ordersData;
    }
    
    console.log(`📦 Total pedidos encontrados: ${orders.length}`);
    
    // 4. Examinar campos de los primeros pedidos
    console.log('\n4. 🔍 EXAMINANDO CAMPOS DE PEDIDOS:');
    
    if (orders.length > 0) {
      const firstOrder = orders[0];
      console.log('Campos disponibles en el primer pedido:');
      Object.keys(firstOrder).forEach(key => {
        const value = firstOrder[key];
        if (key.includes('amount') || key.includes('total') || key.includes('price') || key === 'id' || key === 'order_number') {
          console.log(`   - ${key}: ${value} (${typeof value})`);
        }
      });
      
      console.log('\n📋 PRIMEROS 5 PEDIDOS CON MONTOS:');
      orders.slice(0, 5).forEach((order, index) => {
        console.log(`${index + 1}. ${order.order_number || order.id}:`);
        console.log(`   total_amount: ${order.total_amount} (${typeof order.total_amount})`);
        console.log(`   payment_amount: ${order.payment_amount} (${typeof order.payment_amount})`);
        console.log(`   customer_name: ${order.customer_name || order.client_name}`);
        console.log(`   status: ${order.status}`);
        console.log('');
      });
    } else {
      console.log('❌ No se encontraron pedidos en la respuesta');
    }
    
    // 5. Probar también el endpoint específico de mensajeros
    console.log('\n5. 📡 Probando endpoint específico /api/messenger/orders...');
    const messengerOrdersResponse = await fetch('http://localhost:3001/api/messenger/orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (messengerOrdersResponse.ok) {
      const messengerData = await messengerOrdersResponse.json();
      console.log('✅ Endpoint messenger funciona');
      
      let messengerOrders = [];
      if (messengerData.data?.orders) {
        messengerOrders = messengerData.data.orders;
      } else if (messengerData.orders) {
        messengerOrders = messengerData.orders;
      } else if (Array.isArray(messengerData.data)) {
        messengerOrders = messengerData.data;
      } else if (Array.isArray(messengerData)) {
        messengerOrders = messengerData;
      }
      
      console.log(`📦 Pedidos de mensajero: ${messengerOrders.length}`);
      
      if (messengerOrders.length > 0) {
        console.log('\n📋 PRIMER PEDIDO DE MENSAJERO:');
        const firstMessengerOrder = messengerOrders[0];
        Object.keys(firstMessengerOrder).forEach(key => {
          const value = firstMessengerOrder[key];
          if (key.includes('amount') || key.includes('total') || key.includes('price') || key === 'id' || key === 'order_number') {
            console.log(`   - ${key}: ${value} (${typeof value})`);
          }
        });
      }
    } else {
      console.log('❌ Error en endpoint messenger:', messengerOrdersResponse.status);
    }
    
    console.log('\n🎯 CONCLUSIÓN:');
    if (orders.length > 0 && orders[0].total_amount !== undefined) {
      if (orders[0].total_amount === 0 || orders[0].total_amount === '0' || orders[0].total_amount === null) {
        console.log('❌ PROBLEMA: API devuelve total_amount pero está en 0/null');
        console.log('🔧 Necesitamos arreglar la consulta SQL en el backend');
      } else {
        console.log('✅ API devuelve total_amount correctamente');
        console.log('🔧 El problema puede estar en el frontend mostrando los datos');
      }
    } else {
      console.log('❌ PROBLEMA: API NO incluye campo total_amount');
      console.log('🔧 Necesitamos agregar total_amount a la consulta SQL');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (require.main === module) {
  debugAPIResponse()
    .then(() => {
      console.log('\n🏁 Debug completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error final:', error);
      process.exit(1);
    });
}

module.exports = { debugAPIResponse };
