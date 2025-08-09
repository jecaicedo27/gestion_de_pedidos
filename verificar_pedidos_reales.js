const mysql = require('mysql2/promise');

// Configuración directa sin usar dotenv
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function verificarPedidos() {
  let connection;
  
  try {
    console.log('🚀 VERIFICACIÓN DE PEDIDOS REALES - PERLAS EXPLOSIVAS');
    console.log('===================================================\n');
    
    // Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos\n');
    
    // Contar pedidos totales
    const [totalCount] = await connection.execute(
      'SELECT COUNT(*) as total FROM orders'
    );
    console.log(`📊 Total de pedidos en el sistema: ${totalCount[0].total}`);
    
    // Contar pedidos de SIIGO
    const [siigoCount] = await connection.execute(
      "SELECT COUNT(*) as total FROM orders WHERE order_source = 'siigo_automatic'"
    );
    console.log(`📋 Pedidos importados de SIIGO: ${siigoCount[0].total}\n`);
    
    // Obtener últimos 10 pedidos de SIIGO
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_city,
        o.status,
        o.total_amount,
        o.payment_method,
        o.delivery_method,
        o.siigo_invoice_number,
        o.shipping_date
      FROM orders o
      WHERE o.order_source = 'siigo_automatic'
      ORDER BY o.id DESC
      LIMIT 10
    `);
    
    if (orders.length === 0) {
      console.log('❌ No se encontraron pedidos importados de SIIGO');
      console.log('\nPosibles causas:');
      console.log('1. La importación automática no está activa');
      console.log('2. No hay facturas nuevas en SIIGO');
      console.log('3. Error en las credenciales de SIIGO');
    } else {
      console.log('ÚLTIMOS PEDIDOS IMPORTADOS DE SIIGO:');
      console.log('====================================\n');
      
      orders.forEach((order, index) => {
        console.log(`${index + 1}. Pedido #${order.order_number} (ID: ${order.id})`);
        console.log(`   Cliente: ${order.customer_name}`);
        console.log(`   Total: $${Number(order.total_amount).toLocaleString('es-CO')}`);
        console.log(`   Estado: ${order.status}`);
        console.log(`   Factura SIIGO: ${order.siigo_invoice_number || 'N/A'}`);
        console.log('   ---');
      });
    }
    
    // Estadísticas por estado
    console.log('\n📈 ESTADÍSTICAS POR ESTADO:');
    console.log('==========================');
    const [statusStats] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    statusStats.forEach(stat => {
      console.log(`${stat.status}: ${stat.count} pedidos`);
    });
    
    console.log('\n✅ Sistema listo para pruebas');
    console.log('\n💡 Para iniciar pruebas:');
    console.log('1. Inicie el backend: cd backend && npm run dev');
    console.log('2. Inicie el frontend: cd frontend && npm start');
    console.log('3. Acceda a http://localhost:3000');
    console.log('4. Use las credenciales: admin / admin123');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n⚠️  Error de acceso a la base de datos');
      console.log('Verifique usuario y contraseña de MySQL');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  MySQL no está ejecutándose');
      console.log('Inicie XAMPP y active MySQL');
    }
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
verificarPedidos();
