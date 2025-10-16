const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function debugLogisticsGrouping() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 DEBUG: AGRUPACIÓN EN LOGÍSTICA');
    console.log('==================================\n');
    
    // 1. Verificar estado del pedido FV-2-12666
    console.log('📦 PEDIDO FV-2-12666:');
    const [order12666] = await connection.execute(
      `SELECT o.*, c.name as carrier_name 
       FROM orders o 
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.order_number = 'FV-2-12666'`,
      []
    );
    
    if (order12666.length > 0) {
      const order = order12666[0];
      console.log(`Estado: ${order.status}`);
      console.log(`Método de entrega: ${order.delivery_method}`);
      console.log(`Transportadora ID: ${order.carrier_id}`);
      console.log(`Transportadora: ${order.carrier_name || 'No asignada'}`);
    }
    
    // 2. Ver todos los pedidos listos para entrega
    console.log('\n📋 PEDIDOS LISTOS PARA ENTREGA:');
    const [readyOrders] = await connection.execute(
      `SELECT o.order_number, o.status, o.delivery_method, o.carrier_id, c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
       ORDER BY o.delivery_method, c.name`,
      []
    );
    
    console.log(`Total: ${readyOrders.length} pedidos\n`);
    
    // Agrupar por método/transportadora
    const groups = {};
    readyOrders.forEach(order => {
      let groupKey = 'Sin Asignar';
      
      if (order.delivery_method === 'recoge_bodega') {
        groupKey = 'Recoge en Bodega';
      } else if (order.carrier_name) {
        groupKey = order.carrier_name;
      } else if (order.delivery_method) {
        groupKey = `${order.delivery_method} (sin transportadora)`;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(order);
    });
    
    // Mostrar grupos
    Object.entries(groups).forEach(([key, orders]) => {
      console.log(`\n${key}: ${orders.length} pedidos`);
      orders.forEach(o => {
        console.log(`  - ${o.order_number} (${o.delivery_method || 'sin método'})`);
      });
    });
    
    // 3. Verificar si el problema es el estado del pedido
    console.log('\n🔍 ESTADOS DE PEDIDOS CON CAMIÓN EXTERNO:');
    const [camionExternoOrders] = await connection.execute(
      `SELECT o.order_number, o.status, o.delivery_method, c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE c.name = 'Camión Externo'`,
      []
    );
    
    if (camionExternoOrders.length > 0) {
      camionExternoOrders.forEach(o => {
        console.log(`${o.order_number}: ${o.status}`);
      });
    } else {
      console.log('No hay pedidos asignados a Camión Externo');
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
debugLogisticsGrouping();
