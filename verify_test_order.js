const { query } = require('./backend/config/database');

async function verifyTestOrder() {
  console.log('🔍 Verificando el pedido de prueba creado...\n');

  try {
    // Verificar el pedido recién creado (ID 126)
    const order = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        o.messenger_status,
        o.total_amount,
        u.username as messenger_name,
        u.full_name as messenger_full_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.id = 126
    `);

    if (!order.length) {
      console.log('❌ No se encontró el pedido con ID 126');
      return;
    }

    const testOrder = order[0];
    console.log('📦 PEDIDO DE PRUEBA ENCONTRADO:');
    console.log(`   🆔 ID: ${testOrder.id}`);
    console.log(`   📋 Número: ${testOrder.order_number}`);
    console.log(`   👤 Cliente: ${testOrder.customer_name}`);
    console.log(`   💰 Monto: $${testOrder.total_amount?.toLocaleString('es-CO')}`);
    console.log(`   📍 Estado: ${testOrder.status}`);
    console.log(`   🚚 Método: ${testOrder.delivery_method}`);
    console.log(`   👨‍💼 Mensajero: ${testOrder.messenger_full_name || testOrder.messenger_name} (ID: ${testOrder.assigned_messenger_id})`);
    console.log(`   📱 Messenger Status: ${testOrder.messenger_status}`);

    // Verificar condiciones para que aparezca el botón "Aceptar"
    console.log('\n🎯 VERIFICACIÓN DE CONDICIONES PARA BOTÓN "ACEPTAR":');
    
    const conditions = {
      'assigned_messenger_id existe': testOrder.assigned_messenger_id ? '✅' : '❌',
      'messenger_status es "assigned"': testOrder.messenger_status === 'assigned' ? '✅' : '❌',
      'delivery_method apropiado': ['mensajeria_local', 'domicilio', 'mensajeria_urbana'].includes(testOrder.delivery_method) ? '✅' : '❌',
      'status apropiado': testOrder.status === 'listo_para_entrega' ? '✅' : '❌'
    };

    Object.entries(conditions).forEach(([condition, status]) => {
      console.log(`   ${status} ${condition}`);
    });

    const allConditionsMet = Object.values(conditions).every(status => status === '✅');
    
    console.log(`\n${allConditionsMet ? '✅' : '❌'} ${allConditionsMet ? 'TODAS LAS CONDICIONES CUMPLIDAS' : 'FALTAN CONDICIONES'}`);
    
    if (allConditionsMet) {
      console.log('\n🎉 ¡El mensajero debería ver el botón "Aceptar" para este pedido!');
      console.log(`📲 Busca el pedido: ${testOrder.order_number}`);
      console.log('🔑 Inicia sesión como: mensajero1 (o el usuario con ID 15)');
    } else {
      console.log('\n⚠️  El mensajero NO verá el botón "Aceptar" porque faltan condiciones');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  verifyTestOrder().then(() => {
    console.log('\n🏁 Verificación completada');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { verifyTestOrder };
