const { query } = require('./backend/config/database');

console.log('🔧 Arreglando sistema de aceptación de mensajeros...\n');

async function fixMessengerAcceptanceSystem() {
  try {
    // 1. Primero verificar usuarios mensajeros
    console.log('👥 Verificando mensajeros disponibles...');
    const messengers = await query(`
      SELECT id, username, full_name, email, role 
      FROM users 
      WHERE role = 'mensajero' 
      ORDER BY id
    `);
    
    console.log(`📋 Encontrados ${messengers.length} mensajeros:`);
    console.table(messengers);
    
    if (messengers.length === 0) {
      console.log('❌ No hay mensajeros en el sistema. Necesitas crear usuarios con role "mensajero"');
      return;
    }
    
    // 2. Verificar pedidos listos para entrega
    console.log('\n📦 Verificando pedidos listos para entrega...');
    const readyOrders = await query(`
      SELECT 
        id, 
        order_number, 
        status, 
        delivery_method,
        assigned_messenger_id,
        messenger_status,
        customer_name,
        total_amount
      FROM orders 
      WHERE status = 'listo_para_entrega'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📋 Encontrados ${readyOrders.length} pedidos listos:`);
    console.table(readyOrders);
    
    // 3. Crear pedidos de prueba para mensajeros si no los hay
    if (readyOrders.length === 0) {
      console.log('\n🛠️ Creando pedidos de prueba para mensajeros...');
      
      // Crear un pedido de prueba con mensajería urbana
      const testOrderResult = await query(`
        INSERT INTO orders (
          order_number,
          customer_name,
          customer_phone,
          customer_address,
          customer_city,
          delivery_method,
          status,
          total_amount,
          payment_method,
          created_by,
          assigned_messenger_id,
          messenger_status,
          created_at
        ) VALUES (
          'TEST-MSG-001',
          'Cliente Prueba Mensajero',
          '3001234567',
          'Calle 123 #45-67',
          'Medellín',
          'mensajeria_urbana',
          'listo_para_entrega',
          50000.00,
          'efectivo',
          1,
          ?,
          'assigned',
          NOW()
        )
      `, [messengers[0].id]);
      
      console.log(`✅ Pedido de prueba creado con ID: ${testOrderResult.insertId}`);
    } else {
      // 4. Actualizar un pedido existente para pruebas de mensajero
      console.log('\n🔄 Actualizando pedido existente para mensajería...');
      
      const orderToUpdate = readyOrders[0];
      await query(`
        UPDATE orders 
        SET 
          delivery_method = 'mensajeria_urbana',
          assigned_messenger_id = ?,
          messenger_status = 'assigned'
        WHERE id = ?
      `, [messengers[0].id, orderToUpdate.id]);
      
      console.log(`✅ Pedido ${orderToUpdate.order_number} actualizado para mensajero ${messengers[0].username}`);
    }
    
    // 5. Verificar configuración final
    console.log('\n📊 Verificando configuración final...');
    const finalOrders = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        o.messenger_status,
        o.customer_name,
        u.username as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.assigned_messenger_id IS NOT NULL
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    
    console.log(`📋 Pedidos asignados a mensajeros:`);
    console.table(finalOrders);
    
    // 6. Verificar delivery_tracking table existe
    console.log('\n🔍 Verificando tabla delivery_tracking...');
    try {
      await query('SELECT COUNT(*) as count FROM delivery_tracking LIMIT 1');
      console.log('✅ Tabla delivery_tracking existe');
    } catch (error) {
      console.log('❌ Tabla delivery_tracking NO existe. Creándola...');
      await query(`
        CREATE TABLE delivery_tracking (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          messenger_id INT NOT NULL,
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          accepted_at TIMESTAMP NULL,
          rejected_at TIMESTAMP NULL,
          started_delivery_at TIMESTAMP NULL,
          delivered_at TIMESTAMP NULL,
          failed_at TIMESTAMP NULL,
          payment_collected DECIMAL(10,2) DEFAULT 0.00,
          delivery_fee_collected DECIMAL(10,2) DEFAULT 0.00,
          payment_method VARCHAR(50) NULL,
          delivery_notes TEXT NULL,
          rejection_reason TEXT NULL,
          failure_reason TEXT NULL,
          delivery_latitude DECIMAL(10,8) NULL,
          delivery_longitude DECIMAL(11,8) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_order_id (order_id),
          INDEX idx_messenger_id (messenger_id),
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (messenger_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Tabla delivery_tracking creada');
    }
    
    console.log('\n🎉 Sistema de aceptación de mensajeros configurado correctamente!');
    console.log('\n📋 Resumen:');
    console.log(`   - ${messengers.length} mensajeros disponibles`);
    console.log(`   - ${finalOrders.length} pedidos asignados a mensajeros`);
    console.log('   - Tabla delivery_tracking lista');
    console.log('\n🔍 Para probar:');
    console.log('   1. Inicia sesión como mensajero');
    console.log('   2. Ve a la página de pedidos');  
    console.log('   3. Deberías ver pedidos con botón "Aceptar"');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMessengerAcceptanceSystem();
