const mysql = require('mysql2/promise');

async function checkDatabase() {
  let connection;
  
  try {
    console.log('🔍 Verificando base de datos gestion_pedidos_dev...\n');
    
    // Conectar a gestion_pedidos_dev
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });
    
    // Verificar tablas
    const [tables] = await connection.execute('SHOW TABLES');
    
    console.log('📋 Tablas en gestion_pedidos_dev:');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    // Verificar tablas críticas
    const criticalTables = [
      'users', 
      'customers', 
      'products', 
      'chatgpt_logs', 
      'quotations',
      'quotation_items',
      'orders',
      'order_items'
    ];
    
    console.log('\n🔍 Verificación de tablas críticas:');
    criticalTables.forEach(table => {
      if (tableNames.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} (no encontrada)`);
      }
    });
    
    console.log(`\n📊 Total de tablas: ${tableNames.length}`);
    
    // Verificar algunos registros
    console.log('\n📊 Estadísticas de datos:');
    
    try {
      const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
      console.log(`  - Usuarios: ${users[0].count}`);
    } catch (e) {}
    
    try {
      const [customers] = await connection.execute('SELECT COUNT(*) as count FROM customers');
      console.log(`  - Clientes: ${customers[0].count}`);
    } catch (e) {}
    
    try {
      const [products] = await connection.execute('SELECT COUNT(*) as count FROM products');
      console.log(`  - Productos: ${products[0].count}`);
    } catch (e) {}
    
    try {
      const [orders] = await connection.execute('SELECT COUNT(*) as count FROM orders');
      console.log(`  - Pedidos: ${orders[0].count}`);
    } catch (e) {}
    
    console.log('\n✅ Base de datos gestion_pedidos_dev está disponible');
    console.log('💡 Recomendación: Actualizar backend/.env para usar DB_NAME=gestion_pedidos_dev');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar verificación
checkDatabase();
