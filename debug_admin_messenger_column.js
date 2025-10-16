const { query } = require('./backend/config/database');

async function debugAdminMessengerColumn() {
  console.log('🔍 Depurando columna MENSAJERO para admin...\n');

  try {
    // 1. Verificar que los pedidos tienen mensajeros asignados
    console.log('1. 📋 VERIFICANDO PEDIDOS CON MENSAJEROS EN BASE DE DATOS:');
    const ordersWithMessengers = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as messenger_username,
        u.full_name as messenger_full_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.status = 'en_reparto'
      ORDER BY o.created_at DESC
    `);

    console.log(`Encontrados ${ordersWithMessengers.length} pedidos en reparto:`);
    ordersWithMessengers.forEach((order, index) => {
      console.log(`\n${index + 1}. 📦 ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   👨‍💼 Mensajero ID: ${order.assigned_messenger_id}`);
      console.log(`   📱 Status: ${order.messenger_status}`);
      console.log(`   👤 Username: ${order.messenger_username || 'NULL'}`);
      console.log(`   👨‍💼 Nombre: ${order.messenger_full_name || 'NULL'}`);
    });

    // 2. Verificar la consulta exacta que usa el endpoint de orders para admin
    console.log('\n\n2. 🔍 SIMULANDO CONSULTA DEL ENDPOINT /api/orders (ADMIN):');
    
    // Esta es la consulta que debería estar usando el backend para admin
    const adminQuery = `
      SELECT 
        o.*,
        u.username as assigned_messenger_name,
        u.full_name as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.status = 'en_reparto'
      ORDER BY o.created_at DESC
    `;
    
    const adminResults = await query(adminQuery);
    
    console.log(`Resultados de consulta admin: ${adminResults.length} pedidos`);
    adminResults.forEach((order, index) => {
      console.log(`\n${index + 1}. 📦 ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   👨‍💼 assigned_messenger_id: ${order.assigned_messenger_id}`);
      console.log(`   👤 assigned_messenger_name: ${order.assigned_messenger_name || 'NULL'}`);
      console.log(`   👨‍💼 messenger_name: ${order.messenger_name || 'NULL'}`);
    });

    // 3. Verificar la estructura actual de la respuesta del endpoint
    console.log('\n\n3. 🌐 PROBANDO ENDPOINT REAL /api/orders:');
    
    const fetch = require('node-fetch');
    
    // Necesitamos obtener un token de admin para probar
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ No se pudo obtener token de admin');
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    // Hacer la petición real al endpoint
    const ordersResponse = await fetch('http://localhost:3001/api/orders?status=en_reparto', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ordersResponse.ok) {
      console.log(`❌ Error en endpoint: ${ordersResponse.status} ${ordersResponse.statusText}`);
      return;
    }
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData.data?.orders || [];
    
    console.log(`📡 Respuesta del endpoint: ${orders.length} pedidos`);
    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. 📦 ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   👨‍💼 assigned_messenger_id: ${order.assigned_messenger_id}`);
      console.log(`   📱 messenger_status: ${order.messenger_status}`);
      console.log(`   👤 assigned_messenger_name: ${order.assigned_messenger_name || 'UNDEFINED'}`);
      console.log(`   👨‍💼 messenger_name: ${order.messenger_name || 'UNDEFINED'}`);
    });

    // 4. Diagnóstico del problema
    console.log('\n\n4. 🎯 DIAGNÓSTICO:');
    
    const hasMessengersInDB = ordersWithMessengers.some(o => o.assigned_messenger_id);
    const hasMessengersInEndpoint = orders.some(o => o.assigned_messenger_name || o.messenger_name);
    
    console.log(`✅ Pedidos tienen mensajeros en BD: ${hasMessengersInDB ? 'SÍ' : 'NO'}`);
    console.log(`❓ Endpoint devuelve nombres: ${hasMessengersInEndpoint ? 'SÍ' : 'NO'}`);
    
    if (hasMessengersInDB && !hasMessengersInEndpoint) {
      console.log('🔧 PROBLEMA IDENTIFICADO: El endpoint no está incluyendo la información de mensajeros');
      console.log('💡 SOLUCIÓN: Necesita arreglar la consulta del backend');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  debugAdminMessengerColumn().then(() => {
    console.log('\n🏁 Diagnóstico completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { debugAdminMessengerColumn };
