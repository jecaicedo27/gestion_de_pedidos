const mysql = require('mysql2/promise');

// Configuración directa
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function verificarPedidosExistentes() {
  let connection;
  
  try {
    console.log('🚀 VERIFICACIÓN DE PEDIDOS EXISTENTES - PERLAS EXPLOSIVAS');
    console.log('======================================================\n');
    
    // Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener pedidos por estado
    console.log('📊 PEDIDOS POR ESTADO:');
    console.log('====================');
    
    const estados = [
      'pendiente_por_facturacion',
      'listo_para_entrega',
      'en_logistica',
      'revision_cartera',
      'en_empaque'
    ];
    
    for (const estado of estados) {
      const [pedidos] = await connection.execute(
        'SELECT COUNT(*) as total FROM orders WHERE status = ?',
        [estado]
      );
      console.log(`${estado}: ${pedidos[0].total} pedidos`);
    }
    
    // Obtener 10 pedidos de ejemplo para pruebas
    console.log('\n\n📋 PEDIDOS DE EJEMPLO PARA PRUEBAS:');
    console.log('===================================\n');
    
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.invoice_code,
        o.customer_name,
        o.customer_phone,
        o.customer_city,
        o.customer_department,
        o.status,
        o.total_amount,
        o.payment_method,
        o.delivery_method,
        o.shipping_date,
        COUNT(oi.id) as items_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status IN ('pendiente_por_facturacion', 'listo_para_entrega', 'en_logistica')
      GROUP BY o.id
      ORDER BY o.id DESC
      LIMIT 10
    `);
    
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Pedido #${order.order_number} (ID: ${order.id})`);
      console.log(`   Cliente: ${order.customer_name}`);
      console.log(`   Teléfono: ${order.customer_phone}`);
      console.log(`   Ciudad: ${order.customer_city || 'N/A'}`);
      console.log(`   Total: $${Number(order.total_amount).toLocaleString('es-CO')}`);
      console.log(`   Estado: ${order.status}`);
      console.log(`   Items: ${order.items_count}`);
      console.log(`   ---`);
    });
    
    // Detalles del primer pedido
    if (orders.length > 0) {
      console.log('\n\n🔍 DETALLES DEL PRIMER PEDIDO:');
      console.log('==============================');
      
      const primerPedido = orders[0];
      const [items] = await connection.execute(
        'SELECT * FROM order_items WHERE order_id = ?',
        [primerPedido.id]
      );
      
      console.log(`\nPedido: ${primerPedido.order_number}`);
      console.log(`Cliente: ${primerPedido.customer_name}`);
      console.log(`Estado actual: ${primerPedido.status}`);
      console.log(`Total: $${Number(primerPedido.total_amount).toLocaleString('es-CO')}`);
      
      if (items.length > 0) {
        console.log('\n📝 ITEMS:');
        items.forEach((item, idx) => {
          console.log(`${idx + 1}. ${item.name || 'Producto sin nombre'}`);
          console.log(`   Cantidad: ${item.quantity}`);
          console.log(`   Precio: $${Number(item.price).toLocaleString('es-CO')}`);
        });
      }
    }
    
    // Instrucciones para pruebas
    console.log('\n\n🧪 PLAN DE PRUEBAS:');
    console.log('==================');
    console.log('\n1. PRUEBA DE VISUALIZACIÓN:');
    console.log('   - Abrir http://localhost:3000');
    console.log('   - Ir a la sección de Pedidos');
    console.log('   - Verificar que se muestren los pedidos listados arriba');
    
    console.log('\n2. PRUEBA DE BÚSQUEDA:');
    console.log('   - Buscar por número de pedido');
    console.log('   - Buscar por nombre de cliente');
    console.log('   - Verificar que los filtros funcionen');
    
    console.log('\n3. PRUEBA DE CAMBIO DE ESTADO:');
    console.log('   - Seleccionar un pedido en "pendiente_por_facturacion"');
    console.log('   - Cambiar estado a "confirmado"');
    console.log('   - Verificar que el cambio se refleje');
    
    console.log('\n4. PRUEBA DE EMPAQUE:');
    console.log('   - Ir a la sección de Empaque');
    console.log('   - Iniciar empaque de un pedido');
    console.log('   - Completar el checklist');
    console.log('   - Verificar que el estado cambie');
    
    console.log('\n5. PRUEBA DE LOGÍSTICA:');
    console.log('   - Ir a la sección de Logística');
    console.log('   - Asignar transportadora a un pedido');
    console.log('   - Generar guía de envío');
    
    console.log('\n6. PRUEBA DE PDF:');
    console.log('   - Abrir detalles de un pedido');
    console.log('   - Generar factura PDF');
    console.log('   - Verificar que se descargue correctamente');
    
    console.log('\n\n⚠️  IMPORTANTE:');
    console.log('Si encuentra algún error durante las pruebas, indíqueme:');
    console.log('1. Qué estaba haciendo');
    console.log('2. Qué error apareció');
    console.log('3. En qué pedido ocurrió');
    
    await connection.end();
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
verificarPedidosExistentes();
