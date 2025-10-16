// Debug para investigar el problema con el status del pedido FV-2-12752

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'gestion_pedidos_dev',
  port: 3306
};

async function debugOrderStatusIssue() {
  console.log('🔍 INVESTIGANDO PROBLEMA CON STATUS DEL PEDIDO...\n');
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Verificar la estructura de la tabla orders
    console.log('1. Verificando estructura de la tabla orders...');
    const [structure] = await connection.execute('DESCRIBE orders');
    
    const statusField = structure.find(field => field.Field === 'status');
    console.log('📋 Campo status:', statusField);
    console.log('');
    
    // Verificar todos los status únicos en la tabla
    console.log('2. Verificando todos los status únicos...');
    const [allStatuses] = await connection.execute(
      'SELECT DISTINCT status FROM orders WHERE status IS NOT NULL AND status != ""'
    );
    console.log('📊 Status únicos encontrados:');
    allStatuses.forEach(row => console.log(`   - "${row.status}"`));
    console.log('');
    
    // Verificar pedidos con status vacío
    console.log('3. Verificando pedidos con status vacío...');
    const [emptyStatus] = await connection.execute(
      'SELECT id, order_number, status FROM orders WHERE status = "" OR status IS NULL LIMIT 5'
    );
    console.log('📦 Pedidos con status vacío:', emptyStatus.length);
    emptyStatus.forEach(order => {
      console.log(`   - ${order.order_number}: "${order.status}"`);
    });
    console.log('');
    
    // Verificar el pedido específico FV-2-12752
    console.log('4. Verificando pedido FV-2-12752 específicamente...');
    const [specificOrder] = await connection.execute(
      'SELECT id, order_number, status, delivery_method, carrier_id FROM orders WHERE order_number = ?',
      ['FV-2-12752']
    );
    
    if (specificOrder.length > 0) {
      console.log('📦 Pedido FV-2-12752:', specificOrder[0]);
      console.log('🔧 Status actual length:', specificOrder[0].status.length);
      console.log('🔧 Status bytes:', Buffer.from(specificOrder[0].status).toString('hex'));
    }
    
    // Intentar actualización directa por ID
    console.log('5. Intentando actualización por ID...');
    if (specificOrder.length > 0) {
      const orderId = specificOrder[0].id;
      
      console.log(`   Actualizando pedido ID ${orderId} a status 'listo_para_entrega'`);
      const [updateResult] = await connection.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['listo_para_entrega', orderId]
      );
      
      console.log('   Resultado:', updateResult);
      
      // Verificar actualización
      const [afterUpdate] = await connection.execute(
        'SELECT status FROM orders WHERE id = ?',
        [orderId]
      );
      
      console.log('   Status después de update:', afterUpdate[0]);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

debugOrderStatusIssue().catch(console.error);
