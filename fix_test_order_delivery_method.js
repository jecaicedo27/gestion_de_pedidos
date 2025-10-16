const { query } = require('./backend/config/database');

async function fixTestOrderDeliveryMethod() {
  console.log('🔧 Corrigiendo delivery_method del pedido de prueba...\n');

  try {
    // Actualizar el delivery_method del pedido 126
    await query(`
      UPDATE orders 
      SET delivery_method = 'mensajeria_local' 
      WHERE id = 126
    `);

    console.log('✅ Delivery method actualizado a "mensajeria_local" para el pedido ID 126');

    // Verificar la corrección
    const updatedOrder = await query(`
      SELECT 
        id,
        order_number,
        customer_name,
        status,
        delivery_method,
        assigned_messenger_id,
        messenger_status
      FROM orders 
      WHERE id = 126
    `);

    if (updatedOrder.length) {
      const order = updatedOrder[0];
      console.log('\n📦 PEDIDO CORREGIDO:');
      console.log(`   📋 Número: ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado: ${order.status}`);
      console.log(`   🚚 Método: ${order.delivery_method}`);
      console.log(`   👨‍💼 Mensajero ID: ${order.assigned_messenger_id}`);
      console.log(`   📱 Messenger Status: ${order.messenger_status}`);

      // Verificar condiciones
      const conditions = {
        'assigned_messenger_id existe': order.assigned_messenger_id ? '✅' : '❌',
        'messenger_status es "assigned"': order.messenger_status === 'assigned' ? '✅' : '❌',
        'delivery_method apropiado': ['mensajeria_local', 'domicilio', 'mensajeria_urbana'].includes(order.delivery_method) ? '✅' : '❌',
        'status apropiado': order.status === 'listo_para_entrega' ? '✅' : '❌'
      };

      console.log('\n🎯 CONDICIONES ACTUALIZADAS:');
      Object.entries(conditions).forEach(([condition, status]) => {
        console.log(`   ${status} ${condition}`);
      });

      const allConditionsMet = Object.values(conditions).every(status => status === '✅');
      
      if (allConditionsMet) {
        console.log('\n🎉 ¡TODAS LAS CONDICIONES CUMPLIDAS!');
        console.log('✅ El mensajero ahora debería ver el botón "Aceptar"');
        console.log(`📲 Pedido: ${order.order_number}`);
        console.log('🔑 Inicia sesión como mensajero (usuario ID 15)');
      } else {
        console.log('\n❌ Aún faltan condiciones por cumplir');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  fixTestOrderDeliveryMethod().then(() => {
    console.log('\n🏁 Corrección completada');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixTestOrderDeliveryMethod };
