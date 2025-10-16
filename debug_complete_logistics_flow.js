const mysql = require('mysql2/promise');
const axios = require('axios');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function debugCompleteLogisticsFlow() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 DEBUG COMPLETO DEL FLUJO DE LOGÍSTICA');
    console.log('==========================================\n');
    
    // 1. Verificar pedidos listos en la BD
    console.log('1️⃣ VERIFICANDO PEDIDOS EN LA BASE DE DATOS:');
    const [readyOrders] = await connection.execute(
      `SELECT o.id, o.order_number, o.status, o.delivery_method, o.carrier_id, c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
       ORDER BY o.order_number`
    );
    
    console.log(`Total pedidos listos: ${readyOrders.length}`);
    
    if (readyOrders.length === 0) {
      console.log('⚠️  NO HAY PEDIDOS LISTOS - ACTUALIZANDO ALGUNOS...');
      
      // Actualizar algunos pedidos a "listo_para_entrega"
      await connection.execute(
        `UPDATE orders 
         SET status = 'listo_para_entrega' 
         WHERE status = 'en_empaque' 
         LIMIT 5`
      );
      
      console.log('✅ Actualizado 5 pedidos a listo_para_entrega');
    } else {
      console.log('✅ Pedidos encontrados:');
      readyOrders.slice(0, 3).forEach(o => {
        console.log(`   - ${o.order_number}: ${o.status} | ${o.carrier_name || 'Sin transportadora'}`);
      });
    }
    
    // 2. Probar autenticación
    console.log('\n2️⃣ PROBANDO AUTENTICACIÓN:');
    
    let token;
    try {
      const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      }, { timeout: 5000 });
      
      token = loginResponse.data.token;
      console.log('✅ Login exitoso');
    } catch (loginError) {
      console.log('❌ Error en login:', loginError.message);
      
      // Probar sin autenticación
      console.log('⚠️  Probando endpoint sin autenticación...');
      
      try {
        const response = await axios.get('http://localhost:3001/api/logistics/ready-for-delivery-test', {
          timeout: 5000
        });
        console.log('✅ Endpoint sin auth funciona');
        console.log('Datos:', response.data);
        return;
      } catch (noAuthError) {
        console.log('❌ Endpoint sin auth falló:', noAuthError.message);
      }
    }
    
    // 3. Probar endpoint con token
    if (token) {
      console.log('\n3️⃣ PROBANDO ENDPOINT CON TOKEN:');
      
      try {
        const response = await axios.get('http://localhost:3001/api/logistics/ready-for-delivery', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000
        });
        
        console.log('✅ Endpoint funciona correctamente');
        console.log('Stats recibidos:', response.data.data.stats);
        
        if (response.data.data.stats.total === 0) {
          console.log('⚠️  El endpoint devuelve 0 pedidos');
        }
        
      } catch (apiError) {
        console.log('❌ Error en endpoint:', apiError.message);
        if (apiError.response) {
          console.log('Status:', apiError.response.status);
          console.log('Data:', apiError.response.data);
        }
      }
    }
    
    // 4. Verificar si el endpoint devuelve datos correctos
    console.log('\n4️⃣ VERIFICANDO LÓGICA DEL CONTROLADOR:');
    
    // Simular la lógica del controlador
    const [testOrders] = await connection.execute(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.status, o.delivery_method,
        o.total_amount, o.created_at, o.updated_at, o.carrier_id,
        c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
       ORDER BY o.created_at ASC`
    );
    
    console.log(`Query directa devuelve: ${testOrders.length} pedidos`);
    
    if (testOrders.length > 0) {
      // Agrupar como lo hace el controlador
      const groupedOrders = {
        recoge_bodega: [],
        camion_externo: [],
        interrapidisimo: [],
        otros: []
      };

      testOrders.forEach(order => {
        const { delivery_method, carrier_name } = order;
        
        if (delivery_method === 'recoge_bodega' || delivery_method === 'recogida_tienda') {
          groupedOrders.recoge_bodega.push(order);
        } else if (carrier_name && carrier_name.toLowerCase().includes('camion') && carrier_name.toLowerCase().includes('externo')) {
          groupedOrders.camion_externo.push(order);
        } else if (carrier_name && carrier_name.toLowerCase().includes('inter') && carrier_name.toLowerCase().includes('rapidisimo')) {
          groupedOrders.interrapidisimo.push(order);
        } else {
          groupedOrders.otros.push(order);
        }
      });
      
      console.log('Agrupación local:');
      console.log(`- Recoge en bodega: ${groupedOrders.recoge_bodega.length}`);
      console.log(`- Camión externo: ${groupedOrders.camion_externo.length}`);  
      console.log(`- Inter Rapidísimo: ${groupedOrders.interrapidisimo.length}`);
      console.log(`- Otros: ${groupedOrders.otros.length}`);
      
      if (groupedOrders.camion_externo.length > 0) {
        console.log('\n✅ PEDIDOS EN CAMIÓN EXTERNO:');
        groupedOrders.camion_externo.forEach(o => {
          console.log(`   - ${o.order_number} (${o.customer_name})`);
        });
      }
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
debugCompleteLogisticsFlow();
