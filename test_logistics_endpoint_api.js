const axios = require('axios');

async function testLogisticsEndpoint() {
  console.log('🔍 PROBANDO ENDPOINT DE PEDIDOS LISTOS PARA ENTREGA');
  console.log('=================================================\n');
  
  // Primero necesitamos obtener un token de autenticación
  try {
    // Login como admin
    console.log('1️⃣ Obteniendo token de autenticación...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Token obtenido exitosamente\n');
    
    // Ahora probar el endpoint
    console.log('2️⃣ Probando endpoint /api/logistics/ready-for-delivery...');
    
    const response = await axios.get('http://localhost:3001/api/logistics/ready-for-delivery', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Respuesta exitosa del endpoint\n');
    console.log('📊 DATOS RECIBIDOS:');
    console.log('==================');
    
    const { groupedOrders, stats } = response.data.data;
    
    // Mostrar estadísticas
    console.log('\n📈 ESTADÍSTICAS:');
    console.log(`Total pedidos listos: ${stats.total}`);
    console.log(`- Recoge en Bodega: ${stats.recoge_bodega}`);
    console.log(`- Inter Rapidísimo: ${stats.interrapidisimo}`);
    console.log(`- Camión Externo: ${stats.camion_externo}`);
    console.log(`- Transprensa: ${stats.transprensa}`);
    console.log(`- Envía: ${stats.envia}`);
    console.log(`- Otros: ${stats.otros}`);
    
    // Mostrar agrupaciones
    console.log('\n📦 PEDIDOS AGRUPADOS:');
    
    Object.entries(groupedOrders).forEach(([key, orders]) => {
      if (orders.length > 0) {
        console.log(`\n${key.toUpperCase()}: ${orders.length} pedidos`);
        orders.forEach(order => {
          console.log(`  - ${order.order_number} (${order.customer_name})`);
        });
      }
    });
    
    // Verificar específicamente Camión Externo
    if (groupedOrders.camion_externo && groupedOrders.camion_externo.length > 0) {
      console.log('\n✅ ¡CAMIÓN EXTERNO ESTÁ CORRECTAMENTE AGRUPADO!');
    } else {
      console.log('\n⚠️  NO HAY PEDIDOS EN CAMIÓN EXTERNO');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
      console.error('Status:', error.response.status);
    }
    
    console.log('\n💡 POSIBLES CAUSAS:');
    console.log('1. El backend no está corriendo');
    console.log('2. El puerto 3001 no es el correcto');
    console.log('3. Las credenciales de admin han cambiado');
    console.log('4. Hay un problema con el endpoint');
  }
}

// Ejecutar
testLogisticsEndpoint();
