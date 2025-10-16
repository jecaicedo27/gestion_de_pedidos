const mysql = require('mysql2/promise');

async function checkOrderStatus() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    console.log('🔍 Verificando estado actual del pedido 537 (Ximena)...\n');
    
    const [orders] = await connection.execute(`
      SELECT 
        id,
        order_number,
        status,
        assigned_messenger_id,
        created_at,
        updated_at
      FROM orders 
      WHERE id = 537
    `);
    
    if (orders.length === 0) {
      console.log('❌ No se encontró el pedido 537');
      return;
    }
    
    const order = orders[0];
    console.log('📋 Información del pedido 537:');
    console.log(`   - ID: ${order.id}`);
    console.log(`   - Número: ${order.order_number}`);
    console.log(`   - Estado: ${order.status}`);
    console.log(`   - Mensajero asignado: ${order.assigned_messenger_id}`);
    console.log(`   - Creado: ${order.created_at}`);
    console.log(`   - Actualizado: ${order.updated_at}`);
    
    // También verificar qué mensajero está asignado
    if (order.assigned_messenger_id) {
      const [messenger] = await connection.execute(`
        SELECT id, username, role 
        FROM users 
        WHERE id = ?
      `, [order.assigned_messenger_id]);
      
      if (messenger.length > 0) {
        console.log(`\n👤 Mensajero asignado:`);
        console.log(`   - ID: ${messenger[0].id}`);
        console.log(`   - Usuario: ${messenger[0].username}`);
        console.log(`   - Rol: ${messenger[0].role}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkOrderStatus();
