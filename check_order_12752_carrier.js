const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkOrder12752() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('\n🔍 VERIFICANDO PEDIDO FV-2-12752...\n');
    
    // Buscar el pedido FV-2-12752
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.delivery_method,
        o.carrier_id,
        c.name as carrier_name
      FROM orders o
      LEFT JOIN carriers c ON o.carrier_id = c.id
      WHERE o.order_number = 'FV-2-12752'
    `);

    if (orders.length === 0) {
      console.log('❌ Pedido FV-2-12752 no encontrado');
      return;
    }

    const order = orders[0];
    
    console.log('📦 INFORMACIÓN DEL PEDIDO:');
    console.log('================================');
    console.log(`  Número: ${order.order_number}`);
    console.log(`  ID: ${order.id}`);
    console.log(`  Método de envío: ${order.delivery_method || 'No especificado'}`);
    console.log(`  Carrier ID: ${order.carrier_id || 'NULL'}`);
    console.log(`  Transportadora: ${order.carrier_name || 'Sin asignar'}`);
    console.log('================================\n');
    
    // Si es domicilio y no tiene carrier, asignarlo
    if (order.delivery_method && order.delivery_method.includes('domicilio') && !order.carrier_id) {
      console.log('⚠️  Pedido con domicilio sin carrier asignado');
      console.log('🔧 Asignando Mensajería Local (ID 32)...');
      
      await connection.execute(
        'UPDATE orders SET carrier_id = 32 WHERE id = ?',
        [order.id]
      );
      
      console.log('✅ Carrier asignado correctamente');
      
      // Verificar el cambio
      const [updated] = await connection.execute(`
        SELECT 
          o.id,
          o.order_number,
          o.delivery_method,
          o.carrier_id,
          c.name as carrier_name
        FROM orders o
        LEFT JOIN carriers c ON o.carrier_id = c.id
        WHERE o.id = ?
      `, [order.id]);
      
      const updatedOrder = updated[0];
      console.log('\n📦 ESTADO ACTUALIZADO:');
      console.log('================================');
      console.log(`  Carrier ID: ${updatedOrder.carrier_id}`);
      console.log(`  Transportadora: ${updatedOrder.carrier_name}`);
      console.log('================================');
      
    } else if (order.carrier_id === 32) {
      console.log('✅ El pedido ya tiene Mensajería Local asignada correctamente');
      console.log('\n📌 IMPORTANTE:');
      console.log('   Cuando abras el modal de logística para este pedido,');
      console.log('   el campo "Transportadora" debe aparecer con "Mensajería Local"');
      console.log('   preseleccionado automáticamente.');
    } else if (order.carrier_id) {
      console.log(`✅ El pedido tiene asignada la transportadora: ${order.carrier_name} (ID: ${order.carrier_id})`);
      console.log('\n📌 IMPORTANTE:');
      console.log(`   Cuando abras el modal de logística para este pedido,`);
      console.log(`   el campo "Transportadora" debe aparecer con "${order.carrier_name}"`);
      console.log('   preseleccionado automáticamente.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkOrder12752();
