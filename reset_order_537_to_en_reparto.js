const mysql = require('mysql2/promise');

async function resetOrderToEnReparto() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    console.log('🔄 Conectado a la base de datos');

    // Check current order status
    const [currentOrder] = await connection.execute(
      'SELECT id, order_number, status, assigned_messenger_id FROM orders WHERE id = ?',
      [537]
    );

    if (currentOrder.length === 0) {
      console.log('❌ No se encontró el pedido con ID 537');
      return;
    }

    console.log('📋 Estado actual del pedido:');
    console.log(currentOrder[0]);

    // Reset order to 'en_reparto' status
    await connection.execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      ['en_reparto', 537]
    );

    console.log('✅ Pedido 537 restablecido a estado "en_reparto"');

    // Verify the change
    const [updatedOrder] = await connection.execute(
      'SELECT id, order_number, status, assigned_messenger_id, updated_at FROM orders WHERE id = ?',
      [537]
    );

    console.log('📋 Nuevo estado del pedido:');
    console.log(updatedOrder[0]);

    console.log('✅ El pedido de Ximena (FV-2-13199) ahora está listo para probar la autorización del mensajero');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

resetOrderToEnReparto();
