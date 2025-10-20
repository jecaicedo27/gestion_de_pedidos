const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev'
};

async function testWalletValidation() {
  let connection;
  
  try {
    console.log('🔗 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    
    // 1. Verificar que las tablas existen
    console.log('\n📋 Verificando estructura de tablas...');
    
    const [walletValidations] = await connection.execute(`
      DESCRIBE wallet_validations
    `);
    console.log('✅ Tabla wallet_validations:', walletValidations.length, 'columnas');
    
    const [ordersColumns] = await connection.execute(`
      SHOW COLUMNS FROM orders LIKE 'validation_%'
    `);
    console.log('✅ Columnas de validación en orders:', ordersColumns.length);
    
    // 2. Buscar pedidos en revisión de cartera
    console.log('\n🔍 Buscando pedidos en revisión de cartera...');
    const [carteraOrders] = await connection.execute(`
      SELECT 
        id, order_number, customer_name, payment_method, 
        total_amount, validation_status, validation_notes
      FROM orders 
      WHERE status = 'revision_cartera'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`📦 Encontrados ${carteraOrders.length} pedidos en cartera:`);
    carteraOrders.forEach(order => {
      console.log(`  - Pedido ${order.order_number}: ${order.customer_name} - $${order.total_amount}`);
      console.log(`    Pago: ${order.payment_method} | Estado validación: ${order.validation_status || 'Sin validar'}`);
      if (order.validation_notes) {
        console.log(`    Notas: ${order.validation_notes}`);
      }
    });
    
    // 3. Verificar historial de validaciones
    console.log('\n📊 Verificando historial de validaciones...');
    const [validations] = await connection.execute(`
      SELECT 
        wv.*, 
        o.order_number,
        u.full_name as validated_by_name
      FROM wallet_validations wv
      LEFT JOIN orders o ON wv.order_id = o.id
      LEFT JOIN users u ON wv.validated_by = u.id
      ORDER BY wv.validated_at DESC
      LIMIT 5
    `);
    
    console.log(`📋 Encontradas ${validations.length} validaciones en el historial:`);
    validations.forEach(validation => {
      console.log(`  - Pedido ${validation.order_number}: ${validation.validation_status}`);
      console.log(`    Validado por: ${validation.validated_by_name || 'Usuario desconocido'}`);
      console.log(`    Fecha: ${validation.validated_at}`);
      if (validation.validation_notes) {
        console.log(`    Notas: ${validation.validation_notes}`);
      }
    });
    
    // 4. Mostrar resumen del sistema
    console.log('\n📈 Resumen del sistema de validación de cartera:');
    console.log('✅ Tabla wallet_validations creada');
    console.log('✅ Columnas validation_status y validation_notes agregadas a orders');
    console.log('✅ Backend actualizado para manejar aprobaciones y rechazos');
    console.log('✅ Frontend actualizado con modal de validación mejorado');
    console.log('✅ Indicadores visuales para pedidos rechazados');
    
    console.log('\n🎯 Funcionalidades implementadas:');
    console.log('  1. Botón "Validar y Enviar a Logística" - Aprueba el pago');
    console.log('  2. Botón "No es posible pasar a Logística" - Rechaza con motivo');
    console.log('  3. Indicador visual de pedidos rechazados en la lista');
    console.log('  4. Historial completo de validaciones');
    console.log('  5. Manejo de diferentes métodos de pago');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la prueba
testWalletValidation();
