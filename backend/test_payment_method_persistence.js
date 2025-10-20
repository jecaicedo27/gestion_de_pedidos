// Cargar variables de entorno
require('dotenv').config();

const { query } = require('./config/database');

async function testPaymentMethodPersistence() {
  try {
    console.log('🧪 Probando persistencia de métodos de pago...');
    
    // Obtener algunos pedidos recientes con métodos de pago definidos
    const orders = await query(`
      SELECT id, order_number, customer_name, payment_method, delivery_method, created_at
      FROM orders 
      WHERE payment_method IS NOT NULL 
      AND payment_method != ''
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`📋 Encontrados ${orders.length} pedidos con métodos de pago definidos:`);
    
    for (const order of orders) {
      console.log(`\n📦 Pedido: ${order.order_number}`);
      console.log(`👤 Cliente: ${order.customer_name}`);
      console.log(`💳 Método de pago: ${order.payment_method}`);
      console.log(`🚚 Método de entrega: ${order.delivery_method}`);
      console.log(`📅 Creado: ${order.created_at}`);
      
      // Verificar que el método de pago esté correctamente mapeado
      const validPaymentMethods = ['efectivo', 'transferencia', 'cliente_credito', 'tarjeta_credito', 'pago_electronico', 'contraentrega'];
      
      if (validPaymentMethods.includes(order.payment_method)) {
        console.log(`✅ Método de pago válido`);
      } else {
        console.log(`❌ Método de pago inválido: ${order.payment_method}`);
      }
    }
    
    // Verificar pedidos sin método de pago
    const ordersWithoutPayment = await query(`
      SELECT COUNT(*) as count
      FROM orders 
      WHERE payment_method IS NULL 
      OR payment_method = ''
      OR payment_method = 'undefined'
    `);
    
    console.log(`\n📊 Pedidos sin método de pago definido: ${ordersWithoutPayment[0].count}`);
    
    // Mostrar distribución de métodos de pago
    const paymentDistribution = await query(`
      SELECT payment_method, COUNT(*) as count
      FROM orders 
      WHERE payment_method IS NOT NULL 
      AND payment_method != ''
      GROUP BY payment_method
      ORDER BY count DESC
    `);
    
    console.log('\n📈 Distribución de métodos de pago:');
    for (const dist of paymentDistribution) {
      console.log(`  ${dist.payment_method}: ${dist.count} pedidos`);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

// Ejecutar prueba
testPaymentMethodPersistence().then(() => {
  console.log('\n✅ Prueba completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
