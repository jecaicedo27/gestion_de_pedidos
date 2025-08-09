const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function debugPedido12668() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 ANALIZANDO PEDIDO 12668');
    console.log('========================\n');
    
    // Buscar el pedido 12668
    const [orders] = await connection.execute(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.address, o.city, o.department,
        o.status, o.delivery_method, o.carrier_id, o.payment_method, o.total_amount,
        o.created_at, o.updated_at, o.notes, o.shipping_date,
        c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.order_number LIKE '%12668%'
       ORDER BY o.id DESC`,
      []
    );
    
    if (orders.length === 0) {
      console.log('❌ NO SE ENCONTRÓ EL PEDIDO 12668');
      console.log('\n🔍 Buscando pedidos similares...');
      
      // Buscar pedidos con números similares
      const [similarOrders] = await connection.execute(
        `SELECT order_number, customer_name, status, created_at
         FROM orders 
         WHERE order_number LIKE '%1266%' OR order_number LIKE '%12668%'
         ORDER BY order_number DESC
         LIMIT 10`
      );
      
      if (similarOrders.length > 0) {
        console.log('📦 Pedidos similares encontrados:');
        similarOrders.forEach(o => {
          console.log(`   - ${o.order_number}: ${o.customer_name} (${o.status})`);
        });
      } else {
        console.log('⚠️  No se encontraron pedidos similares');
      }
      
      // Mostrar los últimos pedidos creados
      console.log('\n📋 ÚLTIMOS 10 PEDIDOS CREADOS:');
      const [recentOrders] = await connection.execute(
        `SELECT order_number, customer_name, status, created_at
         FROM orders 
         ORDER BY created_at DESC 
         LIMIT 10`
      );
      
      recentOrders.forEach(o => {
        console.log(`   - ${o.order_number}: ${o.customer_name} (${o.status}) - ${o.created_at}`);
      });
      
    } else {
      console.log(`✅ PEDIDO ENCONTRADO: ${orders.length} resultado(s)\n`);
      
      orders.forEach((order, index) => {
        console.log(`📦 PEDIDO ${index + 1}:`);
        console.log(`   Número: ${order.order_number}`);
        console.log(`   ID: ${order.id}`);
        console.log(`   Cliente: ${order.customer_name}`);
        console.log(`   Teléfono: No disponible en esquema`);
        console.log(`   Dirección: ${order.address || 'No especificada'}`);
        console.log(`   Ciudad: ${order.city || 'No especificada'}`);
        console.log(`   Departamento: ${order.department || 'No especificado'}`);
        console.log(`   Estado: ${order.status}`);
        console.log(`   Método de entrega: ${order.delivery_method || 'No definido'}`);
        console.log(`   Transportadora: ${order.carrier_name || 'Sin asignar'}`);
        console.log(`   Método de pago: ${order.payment_method || 'No especificado'}`);
        console.log(`   Total: $${order.total_amount || 0}`);
        console.log(`   Fecha creación: ${order.created_at}`);
        console.log(`   Última actualización: ${order.updated_at}`);
        console.log(`   Fecha de envío: ${order.shipping_date || 'No programada'}`);
        
        if (order.notes) {
          console.log(`   Notas: ${order.notes.substring(0, 200)}...`);
        }
        console.log('');
      });
      
      // Mostrar próximos pasos según el estado
      const mainOrder = orders[0];
      console.log('🎯 PRÓXIMOS PASOS SUGERIDOS:');
      console.log('============================');
      
      switch (mainOrder.status) {
        case 'pendiente_por_facturacion':
          console.log('📋 El pedido está pendiente de facturación');
          console.log('   - Ir a la sección de Facturación');
          console.log('   - Completar datos del cliente');
          console.log('   - Procesar factura');
          break;
          
        case 'en_logistica':
          console.log('🚚 El pedido está en logística');
          console.log('   - Asignar método de entrega');
          console.log('   - Seleccionar transportadora');
          console.log('   - Procesar a empaque');
          break;
          
        case 'en_empaque':
          console.log('📦 El pedido está en empaque');
          console.log('   - Ir a la sección de Empaque');
          console.log('   - Marcar como empacado');
          console.log('   - Enviar a logística');
          break;
          
        case 'listo_para_entrega':
        case 'empacado':
        case 'listo':
          console.log('✅ El pedido está listo para entrega');
          console.log('   - Aparece en las fichas de logística');
          console.log('   - Asignar a transportadora o mensajero');
          console.log('   - Marcar como en reparto');
          break;
          
        case 'en_reparto':
          console.log('🏃 El pedido está en reparto');
          console.log('   - Seguimiento del mensajero');
          console.log('   - Confirmación de entrega');
          break;
          
        case 'entregado':
          console.log('🎉 El pedido ha sido entregado');
          console.log('   - Proceso completado');
          break;
          
        default:
          console.log(`📋 Estado actual: ${mainOrder.status}`);
          console.log('   - Verificar flujo de trabajo');
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
debugPedido12668();
