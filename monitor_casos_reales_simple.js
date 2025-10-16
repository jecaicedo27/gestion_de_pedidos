const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

// Configuración
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev'
};

async function obtenerPedidosReales() {
  let connection;
  
  try {
    console.log('🚀 MONITOR DE CASOS REALES - PERLAS EXPLOSIVAS');
    console.log('===========================================\n');
    
    // Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener pedidos de SIIGO
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.invoice_code,
        o.customer_name,
        o.customer_phone,
        o.customer_city,
        o.customer_department,
        o.status,
        o.total_amount,
        o.payment_method,
        o.delivery_method,
        o.siigo_invoice_number,
        o.order_source,
        o.shipping_date,
        o.created_at,
        COUNT(oi.id) as items_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_source = 'siigo_automatic'
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 20
    `);
    
    console.log(`📋 Encontrados ${orders.length} pedidos reales de SIIGO\n`);
    
    if (orders.length === 0) {
      console.log('No se encontraron pedidos importados de SIIGO');
      await connection.end();
      return;
    }
    
    // Mostrar lista de pedidos
    console.log('PEDIDOS DISPONIBLES PARA PROBAR:');
    console.log('================================');
    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. Pedido #${order.order_number}`);
      console.log(`   Cliente: ${order.customer_name}`);
      console.log(`   Teléfono: ${order.customer_phone}`);
      console.log(`   Ciudad: ${order.customer_city || 'N/A'} - ${order.customer_department || 'N/A'}`);
      console.log(`   Total: $${order.total_amount.toLocaleString('es-CO')}`);
      console.log(`   Estado: ${order.status}`);
      console.log(`   Items: ${order.items_count}`);
      console.log(`   Método Pago: ${order.payment_method || 'N/A'}`);
      console.log(`   Método Entrega: ${order.delivery_method || 'N/A'}`);
      console.log(`   Fecha Envío: ${order.shipping_date || 'N/A'}`);
      console.log(`   Factura SIIGO: ${order.siigo_invoice_number || 'N/A'}`);
    });
    
    // Mostrar detalles del primer pedido
    console.log('\n\n========================================');
    console.log('📦 DETALLES DEL PRIMER PEDIDO');
    console.log('========================================');
    
    const primerPedido = orders[0];
    
    // Obtener items del pedido
    const [items] = await connection.execute(
      'SELECT * FROM order_items WHERE order_id = ?',
      [primerPedido.id]
    );
    
    console.log(`\nPedido: ${primerPedido.order_number}`);
    console.log(`Cliente: ${primerPedido.customer_name}`);
    console.log(`Total: $${primerPedido.total_amount.toLocaleString('es-CO')}`);
    
    if (items.length > 0) {
      console.log('\n📝 ITEMS DEL PEDIDO:');
      items.forEach(item => {
        console.log(`  - ${item.name}`);
        console.log(`    Cantidad: ${item.quantity}`);
        console.log(`    Precio: $${item.price.toLocaleString('es-CO')}`);
        console.log(`    Subtotal: $${(item.quantity * item.price).toLocaleString('es-CO')}`);
      });
    }
    
    // Instrucciones para pruebas
    console.log('\n\n💡 INSTRUCCIONES PARA PRUEBAS:');
    console.log('==============================');
    console.log('1. Asegúrese de que el backend esté corriendo (npm run backend:dev)');
    console.log('2. Asegúrese de que el frontend esté corriendo (npm run frontend:dev)');
    console.log('3. Abra http://localhost:3000 en su navegador');
    console.log('4. Inicie sesión con credenciales de admin');
    console.log('5. Navegue a la sección de Pedidos');
    console.log('\n🔧 FUNCIONALIDADES A PROBAR:');
    console.log('- Ver lista de pedidos');
    console.log('- Buscar pedidos por número o cliente');
    console.log('- Ver detalles de un pedido');
    console.log('- Cambiar estado del pedido');
    console.log('- Editar información del pedido');
    console.log('- Iniciar proceso de empaque');
    console.log('- Generar PDF de factura');
    console.log('- Asignar transportadora');
    
    console.log('\n⚠️  NOTA: Si encuentra algún error, indíqueme qué estaba haciendo');
    console.log('y qué error apareció para poder solucionarlo rápidamente.\n');
    
    await connection.end();
    console.log('🔌 Conexión cerrada');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
obtenerPedidosReales();
