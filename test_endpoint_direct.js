const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function testLogisticsLogicDirectly() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 PROBANDO LÓGICA DE LOGÍSTICA DIRECTAMENTE');
    console.log('===========================================\n');
    
    // Simular exactamente la misma lógica del controlador
    console.log('1️⃣ Ejecutando query del controlador...');
    
    const [readyOrders] = await connection.execute(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.status, o.delivery_method,
        o.total_amount, o.created_at, o.updated_at, o.carrier_id,
        c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
       ORDER BY o.created_at ASC`
    );
    
    console.log(`✅ Query ejecutada: ${readyOrders.length} pedidos encontrados\n`);
    
    // Mostrar detalles de los primeros pedidos
    console.log('📦 PRIMEROS 5 PEDIDOS:');
    readyOrders.slice(0, 5).forEach(o => {
      console.log(`   ${o.order_number}: method="${o.delivery_method}", carrier="${o.carrier_name}"`);
    });
    
    console.log('\n2️⃣ Agrupando pedidos...');
    
    // Simular exactamente la lógica de agrupación del controlador
    const groupedOrders = {
      recoge_bodega: [],
      interrapidisimo: [],
      transprensa: [], 
      envia: [],
      camion_externo: [],
      mensajero_julian: [],
      mensajero_juan: [],
      otros: []
    };

    readyOrders.forEach(order => {
      const { delivery_method, carrier_name, assigned_messenger_id } = order;
      
      console.log(`Procesando ${order.order_number}: method="${delivery_method}", carrier="${carrier_name}"`);
      
      if (delivery_method === 'recoge_bodega' || delivery_method === 'recogida_tienda') {
        groupedOrders.recoge_bodega.push(order);
        console.log(`  -> RECOGE BODEGA`);
      } else if (carrier_name && carrier_name.toLowerCase().includes('inter') && carrier_name.toLowerCase().includes('rapidisimo')) {
        groupedOrders.interrapidisimo.push(order);
        console.log(`  -> INTER RAPIDÍSIMO`);
      } else if (carrier_name && carrier_name.toLowerCase().includes('transprensa')) {
        groupedOrders.transprensa.push(order);
        console.log(`  -> TRANSPRENSA`);
      } else if (carrier_name && carrier_name.toLowerCase().includes('envia')) {
        groupedOrders.envia.push(order);
        console.log(`  -> ENVÍA`);
      } else if (carrier_name && carrier_name.toLowerCase().includes('camion') && carrier_name.toLowerCase().includes('externo')) {
        groupedOrders.camion_externo.push(order);
        console.log(`  -> CAMIÓN EXTERNO ✅`);
      } else if (delivery_method === 'mensajero') {
        console.log(`  -> MENSAJERO (id: ${assigned_messenger_id})`);
        if (assigned_messenger_id) {
          const messengerName = order.messenger_name?.toLowerCase() || '';
          if (messengerName.includes('julian')) {
            groupedOrders.mensajero_julian.push(order);
          } else if (messengerName.includes('juan')) {
            groupedOrders.mensajero_juan.push(order);
          } else {
            groupedOrders.otros.push(order);
          }
        } else {
          groupedOrders.otros.push(order);
        }
      } else {
        groupedOrders.otros.push(order);
        console.log(`  -> OTROS`);
      }
    });

    // Calcular estadísticas
    const stats = {
      total: readyOrders.length,
      recoge_bodega: groupedOrders.recoge_bodega.length,
      interrapidisimo: groupedOrders.interrapidisimo.length,
      transprensa: groupedOrders.transprensa.length,
      envia: groupedOrders.envia.length,
      camion_externo: groupedOrders.camion_externo.length,
      mensajero_julian: groupedOrders.mensajero_julian.length,
      mensajero_juan: groupedOrders.mensajero_juan.length,
      otros: groupedOrders.otros.length
    };

    console.log('\n📊 RESULTADO FINAL:');
    console.log('==================');
    Object.entries(stats).forEach(([key, value]) => {
      if (key !== 'total') {
        console.log(`${key.toUpperCase()}: ${value} pedidos`);
      }
    });
    
    console.log(`\nTOTAL: ${stats.total} pedidos`);
    
    // Verificar específicamente Camión Externo
    if (groupedOrders.camion_externo.length > 0) {
      console.log('\n🚚 PEDIDOS EN CAMIÓN EXTERNO:');
      groupedOrders.camion_externo.forEach(o => {
        console.log(`   - ${o.order_number} (${o.customer_name})`);
      });
    } else {
      console.log('\n⚠️  NO SE ENCONTRARON PEDIDOS EN CAMIÓN EXTERNO');
      
      // Verificar qué pedidos tienen "Camión" en el nombre
      console.log('\n🔍 Buscando pedidos con "Camión" en transportadora:');
      readyOrders.forEach(o => {
        if (o.carrier_name && o.carrier_name.toLowerCase().includes('camion')) {
          console.log(`   - ${o.order_number}: "${o.carrier_name}"`);
        }
      });
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
testLogisticsLogicDirectly();
