// Debug para investigar por qué FV-2-12752 no aparece en Mensajería Local

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'gestion_pedidos_dev',
  port: 3306
};

async function debugMensajeriaLocalGrouping() {
  console.log('🔍 DEBUGGEANDO AGRUPACIÓN DE MENSAJERÍA LOCAL...\n');
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Obtener pedidos listos para entrega con información completa
    const [orders] = await connection.execute(`
      SELECT 
        o.id, o.order_number, o.customer_name, o.status, o.delivery_method,
        o.total_amount, o.carrier_id,
        c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
       ORDER BY o.created_at ASC
    `);
    
    console.log('📦 PEDIDOS ENCONTRADOS:', orders.length);
    console.log('');
    
    // Buscar específicamente FV-2-12752
    const targetOrder = orders.find(o => o.order_number === 'FV-2-12752');
    
    if (targetOrder) {
      console.log('✅ PEDIDO FV-2-12752 ENCONTRADO:');
      console.log('   ID:', targetOrder.id);
      console.log('   Status:', targetOrder.status);
      console.log('   Delivery Method:', targetOrder.delivery_method);
      console.log('   Carrier ID:', targetOrder.carrier_id);
      console.log('   Carrier Name:', targetOrder.carrier_name);
      console.log('');
      
      // Simular la lógica de agrupación del backend
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
      
      const normalizedCarrier = normalizeText(targetOrder.carrier_name);
      const normalizedMethod = normalizeText(targetOrder.delivery_method);
      
      console.log('🔧 NORMALIZACIÓN:');
      console.log('   Original Carrier:', `"${targetOrder.carrier_name}"`);
      console.log('   Normalized Carrier:', `"${normalizedCarrier}"`);
      console.log('   Original Method:', `"${targetOrder.delivery_method}"`);
      console.log('   Normalized Method:', `"${normalizedMethod}"`);
      console.log('');
      
      // Aplicar la lógica de agrupación actual
      let category = null;
      let reason = '';
      
      if (normalizedMethod === 'recoge_bodega' || normalizedMethod === 'recogida_tienda') {
        category = 'recoge_bodega';
        reason = 'Método de entrega es recogida';
      } else if (normalizedCarrier.includes('inter') && normalizedCarrier.includes('rapidisimo')) {
        category = 'interrapidisimo';
        reason = 'Transportadora contiene "inter" y "rapidisimo"';
      } else if (normalizedCarrier.includes('transprensa')) {
        category = 'transprensa';
        reason = 'Transportadora contiene "transprensa"';
      } else if (normalizedCarrier.includes('envia')) {
        category = 'envia';
        reason = 'Transportadora contiene "envia"';
      } else if (normalizedCarrier.includes('camion') && normalizedCarrier.includes('externo')) {
        category = 'camion_externo';
        reason = 'Transportadora contiene "camion" y "externo"';
      } else if (normalizedMethod === 'mensajeria_local' || normalizedMethod === 'mensajero' || 
                 normalizedCarrier.includes('mensajeria') || normalizedCarrier === 'mensajeria local') {
        category = 'mensajeria_local';
        reason = 'Cumple condiciones de mensajería local';
      } else if (!normalizedMethod && !normalizedCarrier) {
        category = 'mensajeria_local';
        reason = 'Sin método ni transportadora - va a mensajería local por defecto';
      } else {
        category = 'otros';
        reason = 'No cumple ninguna condición específica';
      }
      
      console.log('🎯 RESULTADO DE AGRUPACIÓN:');
      console.log('   Categoría:', category);
      console.log('   Razón:', reason);
      console.log('');
      
      // Verificar condiciones específicas
      console.log('🔍 VERIFICACIÓN DE CONDICIONES:');
      console.log('   normalizedCarrier.includes("mensajeria"):', normalizedCarrier.includes('mensajeria'));
      console.log('   normalizedCarrier === "mensajeria local":', normalizedCarrier === 'mensajeria local');
      console.log('   normalizedMethod === "mensajeria_local":', normalizedMethod === 'mensajeria_local');
      console.log('');
      
    } else {
      console.log('❌ PEDIDO FV-2-12752 NO ENCONTRADO');
      console.log('📋 PEDIDOS DISPONIBLES:');
      orders.forEach(order => {
        console.log(`   - ${order.order_number} (Status: ${order.status})`);
      });
    }
    
    // Mostrar todos los pedidos y sus agrupaciones
    console.log('📊 AGRUPACIÓN DE TODOS LOS PEDIDOS:');
    
    const groupedOrders = {
      recoge_bodega: [],
      interrapidisimo: [],
      transprensa: [], 
      envia: [],
      camion_externo: [],
      mensajeria_local: [],
      mensajero_julian: [],
      mensajero_juan: [],
      otros: []
    };
    
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
    
    orders.forEach(order => {
      const normalizedCarrier = normalizeText(order.carrier_name);
      const normalizedMethod = normalizeText(order.delivery_method);
      
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
      } else if (normalizedMethod === 'mensajeria_local' || normalizedMethod === 'mensajero' || 
                 normalizedCarrier.includes('mensajeria') || normalizedCarrier === 'mensajeria local') {
        groupedOrders.mensajeria_local.push(order);
      } else if (!normalizedMethod && !normalizedCarrier) {
        groupedOrders.mensajeria_local.push(order);
      } else {
        groupedOrders.otros.push(order);
      }
    });
    
    // Mostrar resultados
    Object.keys(groupedOrders).forEach(category => {
      const count = groupedOrders[category].length;
      if (count > 0) {
        console.log(`\n📦 ${category.toUpperCase()}: ${count} pedidos`);
        groupedOrders[category].forEach(order => {
          console.log(`   - ${order.order_number} | ${order.delivery_method || 'NULL'} | ${order.carrier_name || 'NULL'}`);
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

debugMensajeriaLocalGrouping().catch(console.error);
