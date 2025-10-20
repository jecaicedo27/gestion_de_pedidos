const mysql = require('mysql2/promise');

async function checkDatabases() {
  let connection;
  
  try {
    console.log('🔍 Verificando bases de datos disponibles...\n');
    
    // Conectar sin especificar base de datos
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });
    
    // Listar todas las bases de datos
    const [databases] = await connection.execute('SHOW DATABASES');
    
    console.log('📋 Bases de datos disponibles:');
    databases.forEach(db => {
      console.log(`  - ${db.Database}`);
    });
    
    // Buscar la base de datos correcta
    const gestionDb = databases.find(db => 
      db.Database.toLowerCase().includes('gestion') || 
      db.Database.toLowerCase().includes('pedidos')
    );
    
    if (gestionDb) {
      console.log(`\n✅ Base de datos encontrada: ${gestionDb.Database}`);
      
      // Verificar tablas importantes
      await connection.query(`USE ${gestionDb.Database}`);
      const [tables] = await connection.execute('SHOW TABLES');
      
      console.log('\n📋 Tablas en la base de datos:');
      const tableNames = tables.map(t => Object.values(t)[0]);
      
      // Verificar tablas críticas
      const criticalTables = ['users', 'customers', 'products', 'chatgpt_logs', 'quotations'];
      criticalTables.forEach(table => {
        if (tableNames.includes(table)) {
          console.log(`  ✅ ${table}`);
        } else {
          console.log(`  ❌ ${table} (no encontrada)`);
        }
      });
      
      console.log(`\nTotal de tablas: ${tableNames.length}`);
      
    } else {
      console.log('\n❌ No se encontró ninguna base de datos de gestión de pedidos');
      console.log('💡 Es posible que necesites restaurar la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar verificación
checkDatabases();
