const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function debugPedido12668Simple() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 BUSCANDO PEDIDO 12668');
    console.log('=======================\n');
    
    // Buscar el pedido 12668 con columnas básicas
    const [orders] = await connection.execute(
      `SELECT 
        id, order_number, customer_name, status, delivery_method, 
        total_amount, created_at, updated_at
       FROM orders 
       WHERE order_number LIKE '%12668%'
       ORDER BY id DESC`,
      []
    );
    
    if (orders.length === 0) {
      console.log('❌ NO SE ENCONTRÓ EL PEDIDO 12668');
      console.log('\n🔍 Buscando pedidos similares...');
      
      const [similarOrders] = await connection.execute(
        `SELECT order_number, customer_name, status, created_at
         FROM orders 
         WHERE order_number LIKE '%1266%' 
         ORDER BY order_number DESC
         LIMIT 10`
      );
      
      if (similarOrders.length > 0) {
        console.log('📦 Pedidos similares encontrados:');
        similarOrders.forEach(o => {
          console.log(`   - ${o.order_number}: ${o.customer_name} (${o.status})`);
        });
      }
      
      // Mostrar últimos pedidos
      console.log('\n📋 ÚLTIMOS 5 PEDIDOS:');
      const [recentOrders] = await connection.execute(
        `SELECT order_number, customer_name, status, created_at
         FROM orders 
         ORDER BY created_at DESC 
         LIMIT 5`
      );
      
      recentOrders.forEach(o => {
        console.log(`   - ${o.order_number}: ${o.customer_name} (${o.status})`);
      });
      
    } else {
      console.log(`✅ PEDIDO ENCONTRADO: ${orders.length} resultado(s)\n`);
      
      orders.forEach((order, index) => {
        console.log(`📦 PEDIDO ${index + 1}:`);
        console.log(`   Número: ${order.order_number}`);
        console.log(`   ID: ${order.id}`);
        console.log(`   Cliente: ${order.customer_name}`);
        console.log(`   Estado: ${order.status}`);
        console.log(`   Método entrega: ${order.delivery_method || 'No definido'}`);
        console.log(`   Total: $${order.total_amount || 0}`);
        console.log(`   Creado: ${order.created_at}`);
        console.log(`   Actualizado: ${order.updated_at}`);
        console.log('');
      });
      
      // Sugerir próximos pasos
      const mainOrder = orders[0];
      console.log('🎯 PRÓXIMOS PASOS:');
      console.log('==================');
      
      switch (mainOrder.status) {
        case 'pendiente_por_facturacion':
          console.log('📋 Ir a Facturación → Procesar factura');
          break;
        case 'en_logistica':
          console.log('🚚 Ir a Logística → Asignar transportadora → Enviar a empaque');
          break;
        case 'en_empaque':
          console.log('📦 Ir a Empaque → Marcar como empacado');
          break;
        case 'listo_para_entrega':
        case 'empacado':
        case 'listo':
          console.log('✅ Pedido listo → Debería aparecer en fichas de logística');
          break;
        case 'en_reparto':
          console.log('🏃 En reparto → Seguimiento de entrega');
          break;
        case 'entregado':
          console.log('🎉 Entregado → Proceso completado');
          break;
        default:
          console.log(`📋 Estado: ${mainOrder.status} → Verificar flujo`);
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
debugPedido12668Simple();
