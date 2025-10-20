const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugCarrierPreselection() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('\n🔍 DEPURANDO PRESELECCIÓN DE TRANSPORTADORA\n');
    
    // 1. Verificar el pedido FV-2-12752
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
    console.log('📦 PEDIDO FV-2-12752:');
    console.log('================================');
    console.log(`  ID: ${order.id}`);
    console.log(`  Método de envío: ${order.delivery_method}`);
    console.log(`  Carrier ID: ${order.carrier_id}`);
    console.log(`  Transportadora: ${order.carrier_name || 'Sin asignar'}`);
    console.log('================================\n');

    // 2. Verificar todos los carriers disponibles
    const [carriers] = await connection.execute(`
      SELECT id, name, code 
      FROM carriers 
      ORDER BY id
    `);

    console.log('🚚 TRANSPORTADORAS ACTIVAS:');
    console.log('================================');
    carriers.forEach(carrier => {
      const isSelected = carrier.id === order.carrier_id ? ' ✅ (SELECCIONADA)' : '';
      console.log(`  ID ${carrier.id}: ${carrier.name}${isSelected}`);
    });
    console.log('================================\n');

    // 3. Verificar la coincidencia exacta del nombre
    const mensajeriaLocal = carriers.find(c => c.id === 32);
    if (mensajeriaLocal) {
      console.log('📌 INFORMACIÓN DE MENSAJERÍA LOCAL:');
      console.log('================================');
      console.log(`  ID: ${mensajeriaLocal.id}`);
      console.log(`  Nombre en BD: "${mensajeriaLocal.name}"`);
      console.log(`  Código: ${mensajeriaLocal.code}`);
      console.log(`  ¿Es el carrier del pedido?: ${mensajeriaLocal.id === order.carrier_id ? 'SÍ ✅' : 'NO ❌'}`);
      console.log('================================\n');
    }

    // 4. Sugerencia de corrección
    if (order.carrier_id === 32 && mensajeriaLocal) {
      console.log('🔧 DATOS PARA EL FRONTEND:');
      console.log('================================');
      console.log('  El modal debe:');
      console.log(`  1. Recibir carrier_id = ${order.carrier_id}`);
      console.log(`  2. Buscar en la lista de carriers el ID ${order.carrier_id}`);
      console.log(`  3. Preseleccionar: "${mensajeriaLocal.name}"`);
      console.log('\n  IMPORTANTE: El nombre debe coincidir EXACTAMENTE');
      console.log(`  Nombre esperado: "${mensajeriaLocal.name}"`);
      console.log('================================');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

debugCarrierPreselection();
