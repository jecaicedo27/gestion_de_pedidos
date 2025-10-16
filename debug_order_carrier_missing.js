// Debug para investigar por qué el carrier_id no llega al modal

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'gestion_pedidos_dev',
  port: 3306
};

async function debugOrderCarrierId() {
  console.log('🔍 INVESTIGANDO POR QUE CARRIER_ID NO LLEGA AL MODAL...\n');
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Verificar el pedido FV-2-12752 directamente en la BD
    const [orderRows] = await connection.execute(`
      SELECT 
        id, 
        order_number, 
        carrier_id,
        delivery_method,
        customer_name,
        status
      FROM orders 
      WHERE order_number = 'FV-2-12752'
    `);
    
    console.log('📦 PEDIDO EN BASE DE DATOS:');
    console.log(JSON.stringify(orderRows[0], null, 2));
    console.log('');
    
    // Verificar si existe el carrier
    if (orderRows[0]?.carrier_id) {
      const [carrierRows] = await connection.execute(`
        SELECT id, name, code 
        FROM carriers 
        WHERE id = ?
      `, [orderRows[0].carrier_id]);
      
      console.log('🚚 TRANSPORTADORA ASOCIADA:');
      console.log(JSON.stringify(carrierRows[0], null, 2));
    } else {
      console.log('❌ El pedido NO TIENE carrier_id asignado');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

debugOrderCarrierId().catch(console.error);
