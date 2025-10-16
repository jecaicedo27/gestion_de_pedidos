const { query } = require('./backend/config/database');

async function checkDeliveryMethodIssue() {
  console.log('🔍 Investigando problema con delivery_method...\n');

  try {
    // 1. Verificar la estructura de la tabla orders
    console.log('📋 1. Verificando estructura de la tabla orders:');
    const tableStructure = await query(`DESCRIBE orders`);
    
    const deliveryMethodField = tableStructure.find(field => field.Field === 'delivery_method');
    if (deliveryMethodField) {
      console.log('✅ Campo delivery_method encontrado:');
      console.log(`   Tipo: ${deliveryMethodField.Type}`);
      console.log(`   Null: ${deliveryMethodField.Null}`);
      console.log(`   Default: ${deliveryMethodField.Default}`);
    } else {
      console.log('❌ Campo delivery_method NO encontrado');
      return;
    }

    // 2. Verificar el pedido específico
    console.log('\n📦 2. Verificando pedido ID 126:');
    const orderCheck = await query(`
      SELECT id, order_number, delivery_method, LENGTH(delivery_method) as length, 
             CHAR_LENGTH(delivery_method) as char_length,
             HEX(delivery_method) as hex_value
      FROM orders 
      WHERE id = 126
    `);

    if (orderCheck.length) {
      const order = orderCheck[0];
      console.log(`   ID: ${order.id}`);
      console.log(`   Número: ${order.order_number}`);
      console.log(`   Delivery Method: "${order.delivery_method}"`);
      console.log(`   Longitud: ${order.length}`);
      console.log(`   Char Length: ${order.char_length}`);
      console.log(`   Valor HEX: ${order.hex_value}`);
    }

    // 3. Intentar actualización forzada
    console.log('\n🔧 3. Actualizando forzadamente:');
    const updateResult = await query(`
      UPDATE orders 
      SET delivery_method = 'mensajeria_local' 
      WHERE id = 126
    `);
    
    console.log(`   Filas afectadas: ${updateResult.affectedRows}`);
    console.log(`   Changed rows: ${updateResult.changedRows}`);

    // 4. Verificar después de la actualización
    console.log('\n✅ 4. Verificando después del UPDATE:');
    const afterUpdate = await query(`
      SELECT id, order_number, delivery_method, 
             CHAR_LENGTH(delivery_method) as char_length
      FROM orders 
      WHERE id = 126
    `);

    if (afterUpdate.length) {
      const order = afterUpdate[0];
      console.log(`   Delivery Method: "${order.delivery_method}"`);
      console.log(`   Char Length: ${order.char_length}`);
      
      if (order.delivery_method === 'mensajeria_local') {
        console.log('🎉 ¡Actualización exitosa!');
      } else {
        console.log('❌ La actualización no funcionó correctamente');
      }
    }

    // 5. Hacer la verificación final completa
    console.log('\n🎯 5. Verificación final completa:');
    const finalCheck = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.id = 126
    `);

    if (finalCheck.length) {
      const order = finalCheck[0];
      console.log('📦 ESTADO FINAL DEL PEDIDO:');
      console.log(`   📋 Número: ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado: ${order.status}`);
      console.log(`   🚚 Método: "${order.delivery_method}"`);
      console.log(`   👨‍💼 Mensajero: ${order.messenger_name} (ID: ${order.assigned_messenger_id})`);
      console.log(`   📱 Messenger Status: ${order.messenger_status}`);

      // Verificar condiciones
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
        console.log('✅ El mensajero ahora DEBE ver el botón "Aceptar"');
        console.log(`📲 Buscar pedido: ${order.order_number}`);
        console.log('🔑 Iniciar sesión como mensajero (usuario con ID 15)');
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
  checkDeliveryMethodIssue().then(() => {
    console.log('\n🏁 Investigación completada');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { checkDeliveryMethodIssue };
