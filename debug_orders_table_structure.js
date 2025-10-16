const { query } = require('./backend/config/database');

console.log('🔍 Verificando estructura de la tabla orders...\n');

async function debugOrdersTable() {
  try {
    // Mostrar estructura de la tabla orders
    console.log('📋 Estructura de la tabla orders:');
    const structure = await query('DESCRIBE orders');
    
    console.table(structure);
    
    // Contar registros
    console.log('\n📊 Conteo de registros:');
    const count = await query('SELECT COUNT(*) as total FROM orders');
    console.log(`Total de pedidos: ${count[0].total}`);
    
    // Mostrar algunos pedidos con sus columnas básicas
    console.log('\n📦 Primeros 5 pedidos:');
    const orders = await query(`
      SELECT 
        id, 
        order_number, 
        status, 
        delivery_method,
        assigned_messenger_id
      FROM orders 
      LIMIT 5
    `);
    
    console.table(orders);
    
    // Verificar si existen pedidos con estado 'listo_para_entrega'
    console.log('\n🚚 Pedidos listos para entrega:');
    const readyOrders = await query(`
      SELECT 
        COUNT(*) as total
      FROM orders 
      WHERE status = 'listo_para_entrega'
    `);
    console.log(`Total listos para entrega: ${readyOrders[0].total}`);
    
    // Verificar pedidos de mensajería local
    console.log('\n📫 Pedidos de mensajería local:');
    const localOrders = await query(`
      SELECT 
        COUNT(*) as total
      FROM orders 
      WHERE delivery_method = 'mensajeria_local'
    `);
    console.log(`Total mensajería local: ${localOrders[0].total}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugOrdersTable();
