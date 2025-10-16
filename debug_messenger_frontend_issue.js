const axios = require('axios');

console.log('🐛 Debuggeando problema del frontend de mensajeros...\n');

async function debugMessengerFrontendIssue() {
  try {
    // 1. Login como mensajero
    console.log('🔑 1. Iniciando sesión como mensajero...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'mensajero1',
      password: 'mensajero123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login exitoso - Token obtenido');

    // 2. Verificar perfil del usuario
    console.log('\n👤 2. Verificando perfil del usuario...');
    console.log('🔗 Token recibido:', token ? token.substring(0, 50) + '...' : 'NULL');
    
    try {
      const profileResponse = await axios.get('http://localhost:3001/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const userProfile = profileResponse.data.data;
      console.log('📋 Perfil del usuario:', {
        id: userProfile.id,
        username: userProfile.username,
        role: userProfile.role,
        full_name: userProfile.full_name
      });
    } catch (profileError) {
      console.error('❌ Error obteniendo perfil:', profileError.response?.data || profileError.message);
      console.log('\n🔧 Intentando obtener pedidos directamente...');
      
      // 3. Obtener pedidos asignados sin verificar el perfil
      console.log('\n📦 3. Obteniendo pedidos asignados...');
      const ordersResponse = await axios.get('http://localhost:3001/api/messenger/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const orders = ordersResponse.data.data;
      console.log(`✅ ${orders.length} pedidos encontrados para el mensajero`);
      
      // Analizar el primer pedido para ver el estado
      if (orders.length > 0) {
        const order = orders[0];
        console.log('\n📄 Primer pedido:', {
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          status: order.status,
          messenger_status: order.messenger_status,
          assigned_messenger_id: order.assigned_messenger_id,
          delivery_method: order.delivery_method
        });
        
        console.log('\n💡 PROBLEMA IDENTIFICADO:');
        if (order.messenger_status === 'assigned') {
          console.log('✅ El pedido SÍ está asignado (messenger_status = "assigned")');
          console.log('🎯 El botón "Aceptar" DEBERÍA aparecer en el frontend');
          console.log('🔧 Si no aparece, es un problema del frontend React');
        } else {
          console.log(`❌ El pedido NO está en estado "assigned" (estado actual: "${order.messenger_status}")`);
          console.log('🔧 Necesita cambiar el estado del pedido a "assigned" desde logística');
        }
      }
      return;
    }

    // 3. Obtener pedidos asignados
    console.log('\n📦 3. Obteniendo pedidos asignados...');
    const ordersResponse = await axios.get('http://localhost:3001/api/messenger/orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const orders = ordersResponse.data.data;
    console.log(`✅ ${orders.length} pedidos encontrados para el mensajero`);

    // 4. Analizar cada pedido
    console.log('\n🔍 4. Analizando pedidos:');
    orders.forEach((order, index) => {
      console.log(`\n📄 Pedido ${index + 1}:`);
      console.log({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        total: order.total,
        status: order.status,
        delivery_method: order.delivery_method,
        assigned_messenger_id: order.assigned_messenger_id,
        messenger_status: order.messenger_status,
        messenger_name: order.messenger_name
      });

      // 5. Verificar condición para mostrar botón "Aceptar"
      const shouldShowAcceptButton = (
        userProfile.role === 'mensajero' && 
        order.assigned_messenger_id === userProfile.id && 
        order.messenger_status === 'assigned'
      );

      console.log(`\n🎯 Condiciones para botón "Aceptar":`);
      console.log(`   - Es mensajero: ${userProfile.role === 'mensajero'}`);
      console.log(`   - Asignado al mensajero: ${order.assigned_messenger_id} === ${userProfile.id} = ${order.assigned_messenger_id === userProfile.id}`);
      console.log(`   - Estado assigned: ${order.messenger_status === 'assigned'}`);
      console.log(`   - Debe mostrar botón ACEPTAR: ${shouldShowAcceptButton ? '✅ SÍ' : '❌ NO'}`);
    });

    // 6. Conclusión
    console.log('\n📋 DIAGNÓSTICO:');
    
    const hasAssignedOrders = orders.some(order => 
      userProfile.role === 'mensajero' && 
      order.assigned_messenger_id === userProfile.id && 
      order.messenger_status === 'assigned'
    );

    if (hasAssignedOrders) {
      console.log('✅ El sistema está funcionando correctamente');
      console.log('✅ Se deberían mostrar botones de "Aceptar" en el frontend');
      console.log('\n💡 Si no ve los botones:');
      console.log('   1. Verifique que esté logueado como mensajero1');
      console.log('   2. Refresque la página (Ctrl+F5)');
      console.log('   3. Verifique la consola del navegador por errores JavaScript');
    } else {
      console.log('❌ No hay pedidos que cumplan las condiciones para mostrar "Aceptar"');
      console.log('\n🔧 Posibles soluciones:');
      console.log('   1. Asignar un pedido al mensajero desde logística');
      console.log('   2. Cambiar el status del pedido asignado a "assigned"');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

debugMessengerFrontendIssue();
