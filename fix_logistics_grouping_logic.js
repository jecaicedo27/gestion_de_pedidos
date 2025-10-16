const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function fixLogisticsGroupingLogic() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔧 ANALIZANDO Y CORRIGIENDO LÓGICA DE AGRUPACIÓN');
    console.log('==============================================\n');
    
    // Obtener pedidos listos
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
    
    console.log(`📦 Encontrados ${readyOrders.length} pedidos listos\n`);
    
    console.log('🔍 ANÁLISIS DETALLADO DE CADA PEDIDO:');
    console.log('=====================================');
    
    readyOrders.forEach((order, index) => {
      const { delivery_method, carrier_name } = order;
      
      console.log(`\n${index + 1}. ${order.order_number}:`);
      console.log(`   delivery_method: "${delivery_method}"`);
      console.log(`   carrier_name: "${carrier_name}"`);
      
      if (carrier_name) {
        console.log(`   carrier_name.toLowerCase(): "${carrier_name.toLowerCase()}"`);
        console.log(`   includes('camion'): ${carrier_name.toLowerCase().includes('camion')}`);
        console.log(`   includes('externo'): ${carrier_name.toLowerCase().includes('externo')}`);
        console.log(`   includes('inter'): ${carrier_name.toLowerCase().includes('inter')}`);
        console.log(`   includes('rapidisimo'): ${carrier_name.toLowerCase().includes('rapidisimo')}`);
      }
      
      // Aplicar la lógica paso a paso
      if (delivery_method === 'recoge_bodega' || delivery_method === 'recogida_tienda') {
        console.log('   ✅ CLASIFICACIÓN: RECOGE BODEGA');
      } else if (carrier_name && 
                 carrier_name.toLowerCase().includes('inter') && 
                 carrier_name.toLowerCase().includes('rapidisimo')) {
        console.log('   ✅ CLASIFICACIÓN: INTER RAPIDÍSIMO');
      } else if (carrier_name && carrier_name.toLowerCase().includes('transprensa')) {
        console.log('   ✅ CLASIFICACIÓN: TRANSPRENSA');
      } else if (carrier_name && carrier_name.toLowerCase().includes('envia')) {
        console.log('   ✅ CLASIFICACIÓN: ENVÍA');
      } else if (carrier_name && 
                 carrier_name.toLowerCase().includes('camion') && 
                 carrier_name.toLowerCase().includes('externo')) {
        console.log('   ✅ CLASIFICACIÓN: CAMIÓN EXTERNO');
      } else if (delivery_method === 'mensajero') {
        console.log('   ✅ CLASIFICACIÓN: MENSAJERO');
      } else {
        console.log('   ⚠️  CLASIFICACIÓN: OTROS');
      }
    });
    
    // Aplicar lógica mejorada
    console.log('\n🔧 APLICANDO LÓGICA MEJORADA:');
    console.log('=============================');
    
    const groupedOrders = {
      recoge_bodega: [],
      interrapidisimo: [],
      transprensa: [], 
      envia: [],
      camion_externo: [],
      mensajero: [],
      otros: []
    };

    readyOrders.forEach(order => {
      const { delivery_method, carrier_name } = order;
      
      // Normalizar texto para comparación (quitar acentos y convertir a minúsculas)
      const normalizeText = (text) => {
        if (!text) return '';
        return text.toLowerCase()
                  .replace(/á/g, 'a')
                  .replace(/é/g, 'e') 
                  .replace(/í/g, 'i')
                  .replace(/ó/g, 'o')
                  .replace(/ú/g, 'u')
                  .replace(/ñ/g, 'n')
                  .trim();
      };
      
      const normalizedCarrier = normalizeText(carrier_name);
      const normalizedMethod = normalizeText(delivery_method);
      
      if (normalizedMethod === 'recoge_bodega' || normalizedMethod === 'recogida_tienda') {
        groupedOrders.recoge_bodega.push(order);
      } else if (normalizedCarrier.includes('inter') && normalizedCarrier.includes('rapidisimo')) {
        groupedOrders.interrapidisimo.push(order);
      } else if (normalizedCarrier.includes('transprensa')) {
        groupedOrders.transprensa.push(order);
      } else if (normalizedCarrier.includes('envia')) {
        groupedOrders.envia.push(order);
      } else if (normalizedCarrier.includes('camion') && normalizedCarrier.includes('externo')) {
        groupedOrders.camion_externo.push(order);
        console.log(`🚚 ENCONTRADO: ${order.order_number} -> CAMIÓN EXTERNO`);
      } else if (normalizedMethod === 'mensajero') {
        groupedOrders.mensajero.push(order);
      } else {
        groupedOrders.otros.push(order);
      }
    });

    console.log('\n📊 RESULTADO CON LÓGICA MEJORADA:');
    console.log('=================================');
    console.log(`Recoge en Bodega: ${groupedOrders.recoge_bodega.length} pedidos`);
    console.log(`Inter Rapidísimo: ${groupedOrders.interrapidisimo.length} pedidos`);
    console.log(`Transprensa: ${groupedOrders.transprensa.length} pedidos`);
    console.log(`Envía: ${groupedOrders.envia.length} pedidos`);
    console.log(`Camión Externo: ${groupedOrders.camion_externo.length} pedidos`);
    console.log(`Mensajero: ${groupedOrders.mensajero.length} pedidos`);
    console.log(`Otros: ${groupedOrders.otros.length} pedidos`);
    
    if (groupedOrders.camion_externo.length > 0) {
      console.log('\n🎉 ¡CAMIÓN EXTERNO DETECTADO CORRECTAMENTE!');
      groupedOrders.camion_externo.forEach(o => {
        console.log(`   - ${o.order_number} (${o.customer_name})`);
      });
    } else {
      console.log('\n❌ Camión externo sigue sin detectarse');
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
fixLogisticsGroupingLogic();
