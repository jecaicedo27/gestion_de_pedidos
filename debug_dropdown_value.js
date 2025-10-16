const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugDropdownValue() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('\n🔍 DEPURANDO VALOR DEL DROPDOWN\n');
    
    // 1. Obtener todos los carriers activos
    const [carriers] = await connection.execute(`
      SELECT id, name, code 
      FROM carriers 
      ORDER BY id
    `);

    console.log('🚚 CARRIERS DISPONIBLES:');
    console.log('================================');
    carriers.forEach(carrier => {
      console.log(`  ID ${carrier.id}: "${carrier.name}"`);
    });
    console.log('================================\n');

    // 2. Verificar el pedido FV-2-12752
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.carrier_id,
        c.name as carrier_name
      FROM orders o
      LEFT JOIN carriers c ON o.carrier_id = c.id
      WHERE o.order_number = 'FV-2-12752'
    `);

    if (orders.length > 0) {
      const order = orders[0];
      console.log('📦 PEDIDO FV-2-12752:');
      console.log('================================');
      console.log(`  carrier_id: ${order.carrier_id}`);
      console.log(`  carrier_name: "${order.carrier_name}"`);
      console.log('================================\n');

      // 3. Verificar la coincidencia exacta
      const matchingCarrier = carriers.find(c => c.id === order.carrier_id);
      if (matchingCarrier) {
        console.log('✅ COINCIDENCIA ENCONTRADA:');
        console.log('================================');
        console.log(`  Para dropdown value usar: "${matchingCarrier.name}"`);
        console.log(`  Para dropdown label usar: "${matchingCarrier.name}"`);
        console.log('================================');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

debugDropdownValue();
