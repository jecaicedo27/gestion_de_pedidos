const { query } = require('./backend/config/database');

console.log('🔧 Arreglando problema de foreign key para mensajeros...\n');

async function fixMessengerForeignKeyIssue() {
  try {
    // 1. Verificar la estructura actual de foreign keys
    console.log('🔍 Verificando foreign keys en la tabla orders...');
    const foreignKeys = await query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
        AND TABLE_NAME = 'orders' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.table(foreignKeys);
    
    // 2. Eliminar el foreign key problemático si existe
    console.log('\n🗑️ Eliminando foreign key problemático...');
    const problematicFK = foreignKeys.find(fk => 
      fk.COLUMN_NAME === 'assigned_messenger_id' && 
      fk.REFERENCED_TABLE_NAME === 'messengers'
    );
    
    if (problematicFK) {
      await query(`ALTER TABLE orders DROP FOREIGN KEY ${problematicFK.CONSTRAINT_NAME}`);
      console.log(`✅ Foreign key ${problematicFK.CONSTRAINT_NAME} eliminado`);
    } else {
      console.log('ℹ️ No se encontró foreign key problemático');
    }
    
    // 3. Crear el foreign key correcto hacia users
    console.log('\n🔧 Creando foreign key correcto hacia la tabla users...');
    try {
      await query(`
        ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_assigned_messenger 
        FOREIGN KEY (assigned_messenger_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL
      `);
      console.log('✅ Foreign key correcto creado');
    } catch (error) {
      if (error.message.includes('Duplicate key name')) {
        console.log('ℹ️ Foreign key correcto ya existe');
      } else {
        console.log('⚠️ Error creando foreign key:', error.message);
      }
    }
    
    // 4. Ahora probar asignar un mensajero a un pedido
    console.log('\n📦 Probando asignación de mensajero...');
    
    // Obtener primer mensajero
    const messengers = await query(`
      SELECT id, username FROM users WHERE role = 'mensajero' LIMIT 1
    `);
    
    if (messengers.length === 0) {
      console.log('❌ No hay mensajeros disponibles');
      return;
    }
    
    // Obtener primer pedido listo para entrega
    const readyOrders = await query(`
      SELECT id, order_number FROM orders 
      WHERE status = 'listo_para_entrega' 
      LIMIT 1
    `);
    
    if (readyOrders.length === 0) {
      console.log('❌ No hay pedidos listos para entrega');
      return;
    }
    
    const messenger = messengers[0];
    const order = readyOrders[0];
    
    // Asignar mensajero al pedido
    await query(`
      UPDATE orders 
      SET 
        delivery_method = 'mensajeria_urbana',
        assigned_messenger_id = ?,
        messenger_status = 'assigned'
      WHERE id = ?
    `, [messenger.id, order.id]);
    
    console.log(`✅ Pedido ${order.order_number} asignado al mensajero ${messenger.username}`);
    
    // 5. Verificar el resultado
    console.log('\n📊 Verificando asignación...');
    const assignedOrder = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.delivery_method,
        o.messenger_status,
        u.username as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.id = ?
    `, [order.id]);
    
    console.table(assignedOrder);
    
    console.log('\n🎉 ¡Sistema de mensajeros arreglado!');
    console.log('\n📋 Para probar:');
    console.log('   1. Inicia sesión como mensajero (usuario: mensajero1, password: admin123)');
    console.log('   2. Ve a la página de pedidos');  
    console.log('   3. Deberías ver el pedido asignado con botón "Aceptar"');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMessengerForeignKeyIssue();
