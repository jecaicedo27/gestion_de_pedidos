const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function testReadyForDeliveryStatus() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 VERIFICANDO PEDIDOS LISTOS PARA ENTREGA');
    console.log('==========================================\n');
    
    // 1. Ver estados actuales de pedidos
    console.log('📊 CONTEO POR ESTADO:');
    const [statusCount] = await connection.execute(
      `SELECT status, COUNT(*) as count 
       FROM orders 
       GROUP BY status 
       ORDER BY count DESC`
    );
    
    statusCount.forEach(s => {
      console.log(`${s.status}: ${s.count} pedidos`);
    });
    
    // 2. Ver específicamente los estados que busca el endpoint
    console.log('\n🎯 PEDIDOS QUE DEBERÍAN APARECER EN LOGÍSTICA:');
    const [readyOrders] = await connection.execute(
      `SELECT o.id, o.order_number, o.status, o.delivery_method, o.carrier_id, c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
       ORDER BY o.order_number`,
      []
    );
    
    console.log(`Total encontrados: ${readyOrders.length}`);
    
    if (readyOrders.length === 0) {
      console.log('\n⚠️  NO HAY PEDIDOS EN ESTADOS LISTOS PARA ENTREGA');
      console.log('Los estados válidos son: listo_para_entrega, empacado, listo');
      
      // 3. Buscar pedidos que podrían moverse a estos estados
      console.log('\n📦 PEDIDOS EN EMPAQUE QUE PODRÍAN ESTAR LISTOS:');
      const [packagingOrders] = await connection.execute(
        `SELECT id, order_number, status 
         FROM orders 
         WHERE status = 'en_empaque' 
         LIMIT 5`
      );
      
      packagingOrders.forEach(o => {
        console.log(`- ${o.order_number} (${o.status})`);
      });
      
      if (packagingOrders.length > 0) {
        console.log('\n💡 SOLUCIÓN: Actualizar algunos pedidos a estado "empacado"');
        console.log('Actualizando primeros 3 pedidos...');
        
        // Actualizar los primeros 3 pedidos
        for (let i = 0; i < Math.min(3, packagingOrders.length); i++) {
          await connection.execute(
            'UPDATE orders SET status = "empacado" WHERE id = ?',
            [packagingOrders[i].id]
          );
          console.log(`✅ ${packagingOrders[i].order_number} actualizado a "empacado"`);
        }
      }
    } else {
      // Mostrar los pedidos listos
      readyOrders.forEach(o => {
        console.log(`\n📦 ${o.order_number}:`);
        console.log(`   Estado: ${o.status}`);
        console.log(`   Método: ${o.delivery_method || 'sin definir'}`);
        console.log(`   Transportadora: ${o.carrier_name || 'sin asignar'}`);
      });
    }
    
    // 4. Verificar específicamente el pedido con Camión Externo
    console.log('\n🚚 VERIFICANDO PEDIDO CON CAMIÓN EXTERNO:');
    const [camionExterno] = await connection.execute(
      `SELECT o.*, c.name as carrier_name 
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.order_number = 'FV-2-12666'`
    );
    
    if (camionExterno.length > 0) {
      const order = camionExterno[0];
      console.log(`Pedido: ${order.order_number}`);
      console.log(`Estado actual: ${order.status}`);
      console.log(`Transportadora: ${order.carrier_name}`);
      
      if (!['listo_para_entrega', 'empacado', 'listo'].includes(order.status)) {
        console.log('\n⚠️  Este pedido NO está en un estado visible para logística');
        console.log('Actualizando a "listo_para_entrega"...');
        
        await connection.execute(
          'UPDATE orders SET status = "listo_para_entrega" WHERE id = ?',
          [order.id]
        );
        console.log('✅ Actualizado exitosamente');
      }
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
testReadyForDeliveryStatus();
