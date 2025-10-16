const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkAllDeliveryMethods() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    console.log('🔍 ANALIZANDO MÉTODOS DE ENVÍO EN LA BASE DE DATOS...\n');

    // 1. Buscar el pedido por número aproximado
    console.log('📦 Buscando pedidos con ID alrededor de 12745:');
    const [nearbyOrders] = await connection.execute(
      `SELECT id, order_number, delivery_method, carrier_id, status
       FROM orders 
       WHERE id BETWEEN 12740 AND 12750
       ORDER BY id`
    );

    if (nearbyOrders.length > 0) {
      nearbyOrders.forEach(order => {
        console.log(`  ID: ${order.id} - ${order.order_number}`);
        console.log(`     Método: "${order.delivery_method || 'NULL'}" | Carrier: ${order.carrier_id || 'NULL'}`);
      });
    } else {
      console.log('  No se encontraron pedidos en ese rango');
    }

    // 2. Ver todos los valores únicos de delivery_method
    console.log('\n📋 TODOS LOS MÉTODOS DE ENVÍO USADOS:');
    const [methods] = await connection.execute(
      `SELECT DISTINCT delivery_method, COUNT(*) as cantidad
       FROM orders 
       WHERE delivery_method IS NOT NULL
       GROUP BY delivery_method
       ORDER BY cantidad DESC`
    );

    methods.forEach(method => {
      console.log(`  - "${method.delivery_method}": ${method.cantidad} pedidos`);
      if (method.delivery_method && method.delivery_method.toLowerCase().includes('domicilio')) {
        console.log(`    🎯 Contiene "domicilio"`);
      }
    });

    // 3. Buscar pedidos con NULL en carrier_id
    console.log('\n⚠️ PEDIDOS CON CARRIER_ID NULL:');
    const [nullCarriers] = await connection.execute(
      `SELECT id, order_number, delivery_method, status
       FROM orders 
       WHERE carrier_id IS NULL
       AND status IN ('en_logistica', 'listo_para_entrega', 'en_reparto')
       LIMIT 10`
    );

    if (nullCarriers.length > 0) {
      console.log(`  Total encontrados: ${nullCarriers.length}`);
      nullCarriers.forEach(order => {
        console.log(`  - ${order.order_number} (ID: ${order.id})`);
        console.log(`    Método: "${order.delivery_method || 'NULL'}"  | Estado: ${order.status}`);
      });
    } else {
      console.log('  ✅ No hay pedidos activos sin carrier asignado');
    }

    // 4. Verificar métodos de envío en la tabla delivery_methods
    console.log('\n📊 MÉTODOS CONFIGURADOS EN EL SISTEMA:');
    const [configMethods] = await connection.execute(
      'SELECT * FROM delivery_methods WHERE active = true'
    );

    if (configMethods.length > 0) {
      configMethods.forEach(method => {
        console.log(`  - ID: ${method.id} | Código: "${method.code}" | Nombre: "${method.name}"`);
      });
    } else {
      console.log('  ❌ No hay métodos de envío configurados');
    }

    // 5. Buscar pedidos que podrían necesitar Mensajería Local
    console.log('\n🚚 PEDIDOS QUE PODRÍAN NECESITAR MENSAJERÍA LOCAL:');
    const [localDeliveries] = await connection.execute(
      `SELECT id, order_number, delivery_method, carrier_id
       FROM orders 
       WHERE (
         LOWER(delivery_method) LIKE '%domicilio%' 
         OR LOWER(delivery_method) LIKE '%local%'
         OR delivery_method = 'domicilio_ciudad'
       )
       AND carrier_id IS NULL
       LIMIT 10`
    );

    if (localDeliveries.length > 0) {
      console.log(`  Encontrados: ${localDeliveries.length}`);
      localDeliveries.forEach(order => {
        console.log(`  - ${order.order_number} (ID: ${order.id})`);
        console.log(`    Método actual: "${order.delivery_method}"`);
        console.log(`    ❌ Necesita asignación de carrier`);
      });
    } else {
      console.log('  ✅ No hay pedidos de domicilio sin carrier');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkAllDeliveryMethods().catch(console.error);
