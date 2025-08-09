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
    
    // Información importante de las notas
    if (order.notes && order.notes.includes('CONFIRMADO')) {
      console.log('\n💰 PAGO: CONFIRMADO (Transferencia)');
      console.log('📍 DIRECCIÓN: Calle 24 Norte No. 5 - 07 casa 124 Reserva de la Sabana, Armenia');
      console.log('📱 TELÉFONO: 3102944214');
    }
    
    // Obtener items
    const [items] = await connection.execute(
      'SELECT * FROM order_items WHERE order_id = ?',
      [ORDER_ID]
    );
    
    console.log(`\n📝 ITEMS (${items.length}):`);
    let total = 0;
    items.forEach((item, idx) => {
      const subtotal = item.quantity * item.price;
      total += subtotal;
      console.log(`${idx + 1}. ${item.name}`);
      console.log(`   Cantidad: ${item.quantity} | Precio: $${Number(item.price).toLocaleString('es-CO')} | Subtotal: $${Number(subtotal).toLocaleString('es-CO')}`);
    });
    console.log(`\n💵 TOTAL CALCULADO: $${Number(total).toLocaleString('es-CO')}`);
    
    // Historial de cambios
    console.log('\n📅 TIMESTAMPS:');
    console.log(`Creado: ${order.created_at}`);
    console.log(`Actualizado: ${order.updated_at}`);
    
    console.log('\n🎯 PRÓXIMAS ACCIONES POSIBLES:');
    console.log('1. Cambiar estado a "confirmado"');
    console.log('2. Asignar método de pago (ya está confirmado como transferencia)');
    console.log('3. Procesar para empaque');
    console.log('4. Generar factura PDF');
    
    console.log('\n✅ Monitoreo completado');
    console.log('➡️  Ejecute "node monitor_pedido_12666_simple.js" después de cada acción');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
monitorearPedido();
