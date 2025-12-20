const { query, poolEnd } = require('./config/database');

async function removePosTest() {
  try {
    console.log('🗑️ Eliminando pedidos POS de prueba...');

    // Cambiar sale_channel de vuelta a 'regular' o NULL
    const result = await query(
      "UPDATE orders SET sale_channel = 'regular' WHERE order_number IN ('FV-1-132', 'FV-1-133')",
      []
    );

    console.log(`✅ ${result.affectedRows} pedidos actualizados`);

    // Verificar
    const orders = await query(
      "SELECT id, order_number, customer_name, sale_channel FROM orders WHERE order_number IN ('FV-1-132', 'FV-1-133')",
      []
    );

    console.log('\n📊 Pedidos actualizados:');
    orders.forEach(order => {
      console.log(`  - ${order.order_number}: ${order.customer_name} -> sale_channel: ${order.sale_channel}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await poolEnd();
  }
}

removePosTest();
