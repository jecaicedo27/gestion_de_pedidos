const { query } = require('./backend/config/database');

async function fixEnumDeliveryMethod() {
  console.log('🔧 Corrigiendo delivery_method con valor ENUM válido...\n');

  try {
    // Actualizar con valor válido del ENUM
    console.log('📝 Actualizando a "mensajeria_urbana" (valor válido del ENUM)');
    const updateResult = await query(`
      UPDATE orders 
      SET delivery_method = 'mensajeria_urbana' 
      WHERE id = 126
    `);
    
    console.log(`✅ Filas afectadas: ${updateResult.affectedRows}`);
    console.log(`✅ Changed rows: ${updateResult.changedRows}`);

    // Verificar la corrección
    console.log('\n🔍 Verificando después del UPDATE:');
    const verifyOrder = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as messenger_name,
        u.full_name as messenger_full_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.id = 126
    `);

    if (verifyOrder.length) {
      const order = verifyOrder[0];
      console.log('📦 PEDIDO CORREGIDO:');
      console.log(`   📋 Número: ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado: ${order.status}`);
      console.log(`   🚚 Método: "${order.delivery_method}"`);
      console.log(`   👨‍💼 Mensajero: ${order.messenger_full_name || order.messenger_name} (ID: ${order.assigned_messenger_id})`);
      console.log(`   📱 Messenger Status: ${order.messenger_status}`);

      // Verificar condiciones FINALES
      const conditions = {
        'assigned_messenger_id existe': order.assigned_messenger_id ? '✅' : '❌',
        'messenger_status es "assigned"': order.messenger_status === 'assigned' ? '✅' : '❌',
        'delivery_method apropiado': ['mensajeria_local', 'domicilio', 'mensajeria_urbana'].includes(order.delivery_method) ? '✅' : '❌',
        'status apropiado': order.status === 'listo_para_entrega' ? '✅' : '❌'
      };

      console.log('\n🎯 CONDICIONES PARA BOTÓN "ACEPTAR":');
      Object.entries(conditions).forEach(([condition, status]) => {
        console.log(`   ${status} ${condition}`);
      });

      const allConditionsMet = Object.values(conditions).every(status => status === '✅');
      
      if (allConditionsMet) {
        console.log('\n🎉 ¡TODAS LAS CONDICIONES CUMPLIDAS!');
        console.log('✅ El mensajero AHORA SÍ debería ver el botón "Aceptar"');
        console.log(`📲 Pedido: ${order.order_number}`);
        console.log('🔑 Iniciar sesión como mensajero1 (ID: 15)');
        console.log('📍 El pedido debería aparecer en la lista con botón "Aceptar"');
        
        // Mostrar información de login
        console.log('\n🔐 INSTRUCCIONES DE ACCESO:');
        console.log('1. Ir a la aplicación web');
        console.log('2. Iniciar sesión con usuario mensajero (ID: 15)');
        console.log(`3. Buscar el pedido: ${order.order_number}`);
        console.log('4. Debería aparecer el botón "Aceptar" (✅)');
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
  fixEnumDeliveryMethod().then(() => {
    console.log('\n🏁 Corrección completada');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixEnumDeliveryMethod };
