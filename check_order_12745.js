const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkOrder12745() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos'
  });

  try {
    console.log('🔍 Verificando pedido 12745...\n');

    // Obtener información del pedido
    const [orders] = await connection.execute(
      `SELECT 
        id, 
        order_number, 
        delivery_method, 
        carrier_id,
        status,
        payment_method,
        siigo_invoice_number
       FROM orders 
       WHERE id = 12745 OR order_number LIKE '%12745%'`
    );

    if (orders.length > 0) {
      console.log('📦 PEDIDO ENCONTRADO:');
      console.log('====================');
      orders.forEach(order => {
        console.log(`  ID: ${order.id}`);
        console.log(`  Número: ${order.order_number}`);
        console.log(`  Método de envío: ${order.delivery_method || 'NULL'}`);
        console.log(`  Carrier ID: ${order.carrier_id || 'NULL'} ${order.carrier_id === null ? '❌ PROBLEMA DETECTADO' : '✅'}`);
        console.log(`  Estado: ${order.status}`);
        console.log(`  Método de pago: ${order.payment_method}`);
        console.log(`  Factura SIIGO: ${order.siigo_invoice_number || 'N/A'}`);
        
        if (order.delivery_method === 'domicilio_local' && order.carrier_id === null) {
          console.log('\n⚠️ PROBLEMA: Método de envío es domicilio_local pero carrier_id es NULL');
          console.log('   Debería ser carrier_id = 32 (Mensajería Local)');
        }
      });
    } else {
      console.log('❌ No se encontró el pedido 12745');
    }

    // Verificar si Mensajería Local existe
    console.log('\n🚚 Verificando Mensajería Local (ID 32)...');
    const [carrier] = await connection.execute(
      'SELECT * FROM carriers WHERE id = 32'
    );

    if (carrier.length > 0) {
      console.log('✅ Mensajería Local existe:');
      console.log(`   Nombre: ${carrier[0].name}`);
      console.log(`   Activo: ${carrier[0].active ? 'Sí' : 'No'}`);
    } else {
      console.log('❌ No existe transportadora con ID 32');
    }

    // Verificar métodos de envío
    console.log('\n📋 Métodos de envío disponibles:');
    const [methods] = await connection.execute(
      'SELECT * FROM delivery_methods WHERE active = true'
    );
    
    methods.forEach(method => {
      if (method.code.includes('domicilio')) {
        console.log(`  🎯 ${method.code} - ${method.name}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkOrder12745().catch(console.error);
