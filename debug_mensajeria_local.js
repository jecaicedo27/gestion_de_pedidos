const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugMensajeriaLocal() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sistema_pedidos'
  });

  try {
    console.log('🔍 DEBUGGEANDO PROBLEMA CON MENSAJERÍA LOCAL\n');

    // 1. Ver todos los valores de delivery_method
    console.log('1️⃣ Valores únicos de delivery_method en la BD:');
    const [deliveryMethods] = await connection.execute(
      `SELECT DISTINCT delivery_method, COUNT(*) as count 
       FROM orders 
       WHERE delivery_method IS NOT NULL 
       GROUP BY delivery_method`
    );
    deliveryMethods.forEach(dm => {
      console.log(`   - "${dm.delivery_method}": ${dm.count} pedidos`);
    });

    // 2. Ver pedidos con mensajería local
    console.log('\n2️⃣ Pedidos con "mensajeria" en delivery_method:');
    const [mensajeriaOrders] = await connection.execute(
      `SELECT id, order_number, customer_name, delivery_method, status, carrier_id, assigned_messenger_id
       FROM orders 
       WHERE delivery_method LIKE '%mensaj%'
       ORDER BY created_at DESC
       LIMIT 10`
    );
    
    if (mensajeriaOrders.length === 0) {
      console.log('   ❌ No hay pedidos con mensajería en delivery_method');
    } else {
      mensajeriaOrders.forEach(order => {
        console.log(`   📦 ${order.order_number} | ${order.customer_name}`);
        console.log(`      - delivery_method: "${order.delivery_method}"`);
        console.log(`      - status: ${order.status}`);
        console.log(`      - carrier_id: ${order.carrier_id || 'null'}`);
        console.log(`      - assigned_messenger_id: ${order.assigned_messenger_id || 'null'}`);
      });
    }

    // 3. Ver pedidos "sin definir"
    console.log('\n3️⃣ Pedidos con delivery_method = "sin_definir" o NULL:');
    const [sinDefinirOrders] = await connection.execute(
      `SELECT id, order_number, customer_name, delivery_method, status
       FROM orders 
       WHERE delivery_method = 'sin_definir' OR delivery_method IS NULL
       ORDER BY created_at DESC
       LIMIT 5`
    );
    
    sinDefinirOrders.forEach(order => {
      console.log(`   📦 ${order.order_number} | ${order.customer_name}`);
      console.log(`      - delivery_method: "${order.delivery_method || 'NULL'}"`);
      console.log(`      - status: ${order.status}`);
    });

    // 4. Ver pedidos listos para entrega agrupados
    console.log('\n4️⃣ Pedidos listos para entrega por delivery_method:');
    const [readyOrders] = await connection.execute(
      `SELECT delivery_method, COUNT(*) as count
       FROM orders 
       WHERE status IN ('listo_para_entrega', 'empacado', 'listo')
       GROUP BY delivery_method`
    );
    
    readyOrders.forEach(group => {
      console.log(`   - ${group.delivery_method || 'NULL'}: ${group.count} pedidos`);
    });

    // 5. Simular la lógica de agrupación actual
    console.log('\n5️⃣ Simulando lógica de agrupación actual:');
    const [allReadyOrders] = await connection.execute(
      `SELECT id, order_number, delivery_method, carrier_id, assigned_messenger_id
       FROM orders 
       WHERE status IN ('listo_para_entrega', 'empacado', 'listo')
       AND (delivery_method LIKE '%mensaj%' OR delivery_method = 'sin_definir' OR delivery_method IS NULL)`
    );
    
    allReadyOrders.forEach(order => {
      const normalizedMethod = (order.delivery_method || '').toLowerCase().trim();
      let categoria = '';
      
      if (normalizedMethod === 'mensajero') {
        categoria = '➡️ Va a mensajero_julian/juan (si tiene assigned_messenger_id)';
      } else if (normalizedMethod === 'mensajeria_local') {
        categoria = '❌ NO COINCIDE con "mensajero" - Va a OTROS';
      } else if (normalizedMethod === 'sin_definir' || !normalizedMethod) {
        categoria = '❌ Va a OTROS (sin definir)';
      }
      
      console.log(`   📦 ${order.order_number}: "${order.delivery_method}" ${categoria}`);
    });

    // 6. Solución propuesta
    console.log('\n✅ SOLUCIÓN PROPUESTA:');
    console.log('   1. Actualizar la lógica para reconocer "mensajeria_local"');
    console.log('   2. Crear una categoría específica para mensajería local sin asignar');
    console.log('   3. O cambiar el valor guardado de "mensajeria_local" a "mensajero"');

    // 7. Opción de corregir datos existentes
    console.log('\n🔧 OPCIÓN DE CORRECCIÓN:');
    const [mensajeriaLocalCount] = await connection.execute(
      `SELECT COUNT(*) as count FROM orders WHERE delivery_method = 'mensajeria_local'`
    );
    
    if (mensajeriaLocalCount[0].count > 0) {
      console.log(`   Hay ${mensajeriaLocalCount[0].count} pedidos con "mensajeria_local"`);
      console.log('   Para cambiarlos a "mensajero" ejecuta:');
      console.log('   UPDATE orders SET delivery_method = "mensajero" WHERE delivery_method = "mensajeria_local";');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

debugMensajeriaLocal();
