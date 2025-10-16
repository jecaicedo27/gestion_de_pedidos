const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixExistingDomicilioOrders() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    console.log('🔧 CORRIGIENDO PEDIDOS EXISTENTES CON DOMICILIO...\n');

    // 1. Verificar si existe Mensajería Local con ID 32
    const [carrier] = await connection.execute(
      'SELECT * FROM carriers WHERE id = 32'
    );

    if (carrier.length === 0) {
      console.log('❌ No existe Mensajería Local con ID 32');
      return;
    }

    console.log('✅ Mensajería Local confirmada (ID 32)\n');

    // 2. Buscar TODOS los pedidos con domicilio y sin carrier
    const [ordersToFix] = await connection.execute(
      `SELECT id, order_number, delivery_method, carrier_id, status
       FROM orders 
       WHERE (
         delivery_method = 'domicilio' 
         OR delivery_method = 'domicilio_local'
         OR delivery_method = 'domicilio_ciudad'
         OR LOWER(delivery_method) LIKE '%domicilio%'
       )
       AND (carrier_id IS NULL OR carrier_id = 0)`
    );

    console.log(`📦 Pedidos encontrados con domicilio sin carrier: ${ordersToFix.length}`);

    if (ordersToFix.length > 0) {
      console.log('\n🔧 Corrigiendo pedidos:');
      console.log('=' .repeat(60));
      
      for (const order of ordersToFix) {
        console.log(`\n📝 Pedido: ${order.order_number}`);
        console.log(`   ID: ${order.id}`);
        console.log(`   Método: "${order.delivery_method}"`);
        console.log(`   Estado: ${order.status}`);
        console.log(`   Carrier actual: ${order.carrier_id || 'NULL'}`);
        
        // Actualizar el carrier_id a 32
        const [result] = await connection.execute(
          'UPDATE orders SET carrier_id = 32 WHERE id = ?',
          [order.id]
        );
        
        if (result.affectedRows > 0) {
          console.log(`   ✅ ACTUALIZADO -> carrier_id = 32 (Mensajería Local)`);
        } else {
          console.log(`   ⚠️ No se pudo actualizar`);
        }
      }
      
      console.log('\n' + '=' .repeat(60));
      console.log(`✅ COMPLETADO: Se corrigieron ${ordersToFix.length} pedidos`);
    } else {
      console.log('✅ No hay pedidos que corregir');
    }

    // 3. Verificar el resultado final
    console.log('\n📊 VERIFICACIÓN FINAL:');
    console.log('=' .repeat(60));
    
    const [summary] = await connection.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN carrier_id = 32 THEN 1 ELSE 0 END) as con_mensajeria_local,
        SUM(CASE WHEN carrier_id IS NULL THEN 1 ELSE 0 END) as sin_carrier
       FROM orders 
       WHERE delivery_method = 'domicilio' 
          OR delivery_method = 'domicilio_local'
          OR delivery_method = 'domicilio_ciudad'
          OR LOWER(delivery_method) LIKE '%domicilio%'`
    );

    const stats = summary[0];
    console.log(`  Total pedidos con domicilio: ${stats.total}`);
    console.log(`  ✅ Con Mensajería Local (ID 32): ${stats.con_mensajeria_local}`);
    console.log(`  ❌ Sin carrier asignado: ${stats.sin_carrier}`);

    if (stats.sin_carrier > 0) {
      console.log('\n⚠️ ATENCIÓN: Aún hay pedidos sin carrier. Revisa los logs del backend.');
    } else {
      console.log('\n✅ ÉXITO: Todos los pedidos con domicilio tienen Mensajería Local asignada');
    }

    // 4. Verificar específicamente el pedido mencionado
    console.log('\n🔍 Verificando pedido FV-2-12745 (ID 33):');
    const [specific] = await connection.execute(
      `SELECT id, order_number, delivery_method, carrier_id, status
       FROM orders 
       WHERE order_number = 'FV-2-12745' OR id = 33`
    );

    if (specific.length > 0) {
      const order = specific[0];
      console.log(`  Número: ${order.order_number}`);
      console.log(`  ID: ${order.id}`);
      console.log(`  Método: "${order.delivery_method}"`);
      console.log(`  Carrier: ${order.carrier_id === 32 ? '✅ Mensajería Local (ID 32)' : '❌ ' + (order.carrier_id || 'NULL')}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixExistingDomicilioOrders().catch(console.error);
