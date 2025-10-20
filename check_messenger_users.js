const { query } = require('./backend/config/database');

async function checkMessengerUsers() {
  console.log('👥 Verificando usuarios mensajeros disponibles...\n');

  try {
    // Verificar todos los usuarios mensajeros
    const messengers = await query(`
      SELECT 
        id,
        username,
        email,
        full_name,
        role,
        active,
        created_at
      FROM users 
      WHERE role = 'mensajero'
      ORDER BY id
    `);

    console.log('📋 USUARIOS MENSAJEROS ENCONTRADOS:');
    console.log(`Total: ${messengers.length} usuarios\n`);

    if (messengers.length === 0) {
      console.log('❌ No se encontraron usuarios mensajeros');
      console.log('🔧 Creando usuario mensajero de prueba...');
      
      // Crear un usuario mensajero de prueba
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('mensajero123', 10);
      
      await query(`
        INSERT INTO users (username, email, password, full_name, role, active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['mensajero1', 'mensajero1@test.com', hashedPassword, 'Mensajero de Prueba', 'mensajero', 1]);
      
      console.log('✅ Usuario mensajero creado:');
      console.log('   👤 Usuario: mensajero1');
      console.log('   🔑 Contraseña: mensajero123');
      console.log('   📧 Email: mensajero1@test.com');
      
    } else {
      messengers.forEach((messenger, index) => {
        console.log(`${index + 1}. 👤 MENSAJERO ID: ${messenger.id}`);
        console.log(`   📛 Username: ${messenger.username}`);
        console.log(`   📧 Email: ${messenger.email}`);
        console.log(`   👨‍💼 Nombre: ${messenger.full_name || 'Sin nombre'}`);
        console.log(`   ✅ Activo: ${messenger.active ? 'Sí' : 'No'}`);
        console.log(`   📅 Creado: ${new Date(messenger.created_at).toLocaleString()}`);
        console.log('');
      });
    }

    // Verificar si existe el pedido de prueba asignado
    console.log('📦 VERIFICANDO PEDIDO DE PRUEBA:');
    const testOrder = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as messenger_username
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.order_number LIKE 'TEST-MSG%'
      ORDER BY o.created_at DESC
      LIMIT 1
    `);

    if (testOrder.length > 0) {
      const order = testOrder[0];
      console.log(`✅ Pedido de prueba encontrado: ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado: ${order.status}`);
      console.log(`   🚚 Delivery Method: ${order.delivery_method}`);
      console.log(`   👨‍💼 Mensajero ID: ${order.assigned_messenger_id}`);
      console.log(`   📱 Messenger Status: ${order.messenger_status}`);
      console.log(`   👤 Username: ${order.messenger_username || 'N/A'}`);
      
      // Verificar si las condiciones están correctas
      const conditions = {
        'assigned_messenger_id existe': order.assigned_messenger_id ? '✅' : '❌',
        'messenger_status es "assigned"': order.messenger_status === 'assigned' ? '✅' : '❌',
        'delivery_method apropiado': ['mensajeria_local', 'domicilio', 'mensajeria_urbana'].includes(order.delivery_method) ? '✅' : '❌',
        'status apropiado': order.status === 'listo_para_entrega' ? '✅' : '❌'
      };

      console.log('\n🎯 CONDICIONES PARA VER BOTÓN "ACEPTAR":');
      Object.entries(conditions).forEach(([condition, status]) => {
        console.log(`   ${status} ${condition}`);
      });

      const allConditionsMet = Object.values(conditions).every(status => status === '✅');
      
      if (allConditionsMet) {
        console.log('\n🎉 ¡CONDICIONES CUMPLIDAS!');
        console.log('✅ El mensajero debería ver el botón "Aceptar"');
      } else {
        console.log('\n❌ Hay condiciones que no se cumplen');
      }
      
    } else {
      console.log('❌ No se encontró pedido de prueba');
    }

    // Mostrar instrucciones de login
    console.log('\n🔐 INSTRUCCIONES DE LOGIN:');
    if (messengers.length > 0) {
      const activeMessenger = messengers.find(m => m.active === 1) || messengers[0];
      console.log(`👤 Usuario sugerido: ${activeMessenger.username}`);
      console.log('🔑 Contraseña sugerida: mensajero123 (si no funciona, usar admin123)');
      console.log(`📧 Email alternativo: ${activeMessenger.email}`);
    } else {
      console.log('👤 Usuario creado: mensajero1');
      console.log('🔑 Contraseña: mensajero123');
    }
    
    console.log('\n📋 PASOS PARA PROBAR:');
    console.log('1. Usar las credenciales mostradas arriba');
    console.log('2. Ir a localhost:3000/login');
    console.log('3. Iniciar sesión como mensajero');
    console.log('4. Buscar pedido TEST-MSG-*');
    console.log('5. Debería ver el botón "Aceptar" ✅');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  checkMessengerUsers().then(() => {
    console.log('\n🏁 Verificación completada');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { checkMessengerUsers };
