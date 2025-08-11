const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixDomicilioLocalCarrier() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    console.log('🔧 CORRIGIENDO PEDIDOS CON DOMICILIO LOCAL...\n');

    // 1. Verificar si existe Mensajería Local con ID 32
    const [carrier] = await connection.execute(
      'SELECT * FROM carriers WHERE id = 32'
    );

    if (carrier.length === 0) {
      console.log('⚠️ No existe Mensajería Local con ID 32, creándola...');
      
      await connection.execute(
        `INSERT INTO carriers (id, name, phone, contact_name, active, created_at) 
         VALUES (32, 'Mensajería Local', '3001234567', 'Mensajero Local', true, NOW())
         ON DUPLICATE KEY UPDATE name = 'Mensajería Local', active = true`
      );
      
      console.log('✅ Mensajería Local creada con ID 32');
    } else {
      console.log('✅ Mensajería Local ya existe con ID 32');
    }

    // 2. Buscar todos los pedidos con domicilio_local y carrier_id NULL
    const [ordersToFix] = await connection.execute(
      `SELECT id, order_number, delivery_method, carrier_id 
       FROM orders 
       WHERE delivery_method = 'domicilio_local' 
       AND (carrier_id IS NULL OR carrier_id = 0)`
    );

    console.log(`\n📦 Pedidos encontrados con domicilio_local y carrier_id NULL: ${ordersToFix.length}`);

    if (ordersToFix.length > 0) {
      console.log('\nCorrigiendo pedidos:');
      
      for (const order of ordersToFix) {
        console.log(`  📝 Pedido ${order.order_number} (ID: ${order.id})`);
        console.log(`     Método: ${order.delivery_method}`);
        console.log(`     Carrier actual: ${order.carrier_id || 'NULL'}`);
        
        // Actualizar el carrier_id a 32
        await connection.execute(
          'UPDATE orders SET carrier_id = 32 WHERE id = ?',
          [order.id]
        );
        
        console.log(`     ✅ Actualizado a carrier_id = 32`);
      }
      
      console.log(`\n✅ Se corrigieron ${ordersToFix.length} pedidos`);
    } else {
      console.log('✅ No hay pedidos que corregir');
    }

    // 3. Verificar el pedido 12745 específicamente
    console.log('\n🔍 Verificando pedido 12745 específicamente:');
    const [order12745] = await connection.execute(
      `SELECT id, order_number, delivery_method, carrier_id, status
       FROM orders 
       WHERE id = 12745`
    );

    if (order12745.length > 0) {
      const order = order12745[0];
      console.log(`  ID: ${order.id}`);
      console.log(`  Número: ${order.order_number}`);
      console.log(`  Método de envío: ${order.delivery_method}`);
      console.log(`  Carrier ID: ${order.carrier_id || 'NULL'}`);
      console.log(`  Estado: ${order.status}`);
      
      if (order.delivery_method === 'domicilio_local' && !order.carrier_id) {
        console.log('\n  🔧 Corrigiendo pedido 12745...');
        await connection.execute(
          'UPDATE orders SET carrier_id = 32 WHERE id = 12745'
        );
        console.log('  ✅ Pedido 12745 corregido');
      }
    } else {
      console.log('  ❌ No se encontró el pedido 12745');
    }

    // 4. Mostrar resumen final
    console.log('\n📊 RESUMEN FINAL:');
    const [summary] = await connection.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN carrier_id = 32 THEN 1 ELSE 0 END) as con_carrier,
        SUM(CASE WHEN carrier_id IS NULL THEN 1 ELSE 0 END) as sin_carrier
       FROM orders 
       WHERE delivery_method = 'domicilio_local'`
    );

    const stats = summary[0];
    console.log(`  Total pedidos con domicilio_local: ${stats.total}`);
    console.log(`  Con Mensajería Local asignada: ${stats.con_carrier}`);
    console.log(`  Sin carrier asignado: ${stats.sin_carrier}`);

    if (stats.sin_carrier > 0) {
      console.log('\n⚠️ Aún hay pedidos sin carrier asignado. Revisa la lógica del backend.');
    } else {
      console.log('\n✅ Todos los pedidos con domicilio_local tienen carrier asignado correctamente');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixDomicilioLocalCarrier().catch(console.error);
