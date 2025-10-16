const fetch = require('node-fetch');

async function testLogisticsCarriers() {
  console.log('🔍 Verificando transportadoras en logística...\n');
  
  try {
    // 1. Login
    console.log('1️⃣ Iniciando sesión...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('✅ Sesión iniciada\n');
    
    // 2. Obtener pedidos listos para entrega
    console.log('2️⃣ Obteniendo pedidos listos para entrega...');
    const readyResponse = await fetch('http://localhost:3001/api/logistics/ready-for-delivery', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const readyData = await readyResponse.json();
    
    if (readyData.success) {
      console.log('✅ Respuesta exitosa\n');
      console.log('📊 Estadísticas:');
      console.log(JSON.stringify(readyData.data.stats, null, 2));
      
      console.log('\n📦 Pedidos agrupados por transportadora:');
      const grouped = readyData.data.groupedOrders;
      
      for (const [carrier, orders] of Object.entries(grouped)) {
        console.log(`\n🚚 ${carrier}: ${orders.length} pedidos`);
        orders.forEach(order => {
          console.log(`   - ${order.order_number} | ${order.customer_name} | ${order.carrier_name || 'Sin carrier'}`);
        });
      }
      
      // Verificar carriers disponibles
      console.log('\n3️⃣ Verificando carriers en la base de datos...');
      const carriersResponse = await fetch('http://localhost:3001/api/logistics/carriers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const carriersData = await carriersResponse.json();
      
      if (carriersData.success) {
        console.log('\n📋 Carriers disponibles:');
        carriersData.data.forEach(carrier => {
          console.log(`   - ${carrier.name} (${carrier.display_name})`);
        });
      }
      
    } else {
      console.log('❌ Error:', readyData.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLogisticsCarriers();
