const mysql = require('mysql2/promise');

// Configuración
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

const ORDER_ID = 162; // ID del pedido FV-2-12666

async function monitorearPedido() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 MONITOR PEDIDO #FV-2-12666');
    console.log('================================\n');
    
    // Obtener estado actual del pedido
    const [orderData] = await connection.execute(
      'SELECT * FROM orders WHERE id = ?',
      [ORDER_ID]
    );
    
    if (orderData.length === 0) {
      console.log('❌ Pedido no encontrado');
      return;
    }
    
    const order = orderData[0];
    
    console.log('📦 INFORMACIÓN ACTUAL:');
    console.log(`Número: ${order.order_number}`);
    console.log(`Cliente: ${order.customer_name}`);
    console.log(`Estado: ${order.status}`);
    console.log(`Total: $${Number(order.total_amount).toLocaleString('es-CO')}`);
    console.log(`Método Pago: ${order.payment_method || 'No definido'}`);
    console.log(`Método Entrega: ${order.delivery_method || 'No definido'}`);
    console.log(`Fecha Envío: ${order.shipping_date || 'No definida'}`);
    console.log(`Notas: ${order.notes || 'Sin notas'}`);
    
    // Obtener items
    const [items] = await connection.execute(
      'SELECT * FROM order_items WHERE order_id = ?',
      [ORDER_ID]
    );
    
    console.log(`\n📝 ITEMS (${items.length}):`);
    items.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.name}`);
      console.log(`   Cantidad: ${item.quantity} | Precio: $${Number(item.price).toLocaleString('es-CO')}`);
    });
    
    // Verificar si existe en empaque
    const [packagingData] = await connection.execute(
      'SELECT * FROM packaging_checklist WHERE order_id = ?',
      [ORDER_ID]
    );
    
    if (packagingData.length > 0) {
      console.log('\n📦 ESTADO DE EMPAQUE:');
      console.log(`Items empacados: ${packagingData.length}`);
      const completed = packagingData.filter(p => p.is_checked).length;
      console.log(`Completados: ${completed}/${packagingData.length}`);
    } else {
      console.log('\n📦 EMPAQUE: No iniciado');
    }
    
    // Verificar si existe en logística
    const [logisticsData] = await connection.execute(
      'SELECT * FROM logistics WHERE order_id = ?',
      [ORDER_ID]
    );
    
    if (logisticsData.length > 0) {
      const logistics = logisticsData[0];
      console.log('\n🚚 ESTADO DE LOGÍSTICA:');
      console.log(`Transportadora: ${logistics.carrier_id || 'No asignada'}`);
      console.log(`Número de guía: ${logistics.tracking_number || 'No generada'}`);
    } else {
      console.log('\n🚚 LOGÍSTICA: No procesada');
    }
    
    // Historial de cambios
    console.log('\n📅 TIMESTAMPS:');
    console.log(`Creado: ${order.created_at}`);
    console.log(`Actualizado: ${order.updated_at}`);
    
    console.log('\n✅ Monitoreo completado');
    console.log('➡️  Ejecute este script nuevamente después de cada acción para ver los cambios');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar cada vez que se llame
monitorearPedido();
