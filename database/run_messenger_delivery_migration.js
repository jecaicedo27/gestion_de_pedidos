const mysql = require('mysql2');
const fs = require('fs');

// Configuración de la base de datos
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', 
  database: 'gestion_pedidos_dev',
  multipleStatements: true
});

async function runMigration() {
  try {
    console.log('🔄 EJECUTANDO MIGRACIÓN DEL SISTEMA DE ENTREGAS...\n');

    // Leer el archivo SQL
    const sqlContent = fs.readFileSync('./database/create_messenger_delivery_system.sql', 'utf8');
    
    console.log('📂 Archivo SQL leído correctamente');
    console.log('🗃️ Ejecutando migración...\n');

    // Ejecutar la migración
    await new Promise((resolve, reject) => {
      db.query(sqlContent, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });

    console.log('✅ Migración ejecutada exitosamente\n');

    // Verificar las tablas creadas
    console.log('🔍 Verificando estructura creada...\n');
    
    const tables = [
      'orders', 
      'delivery_tracking', 
      'delivery_evidence', 
      'messenger_cash_closure',
      'messenger_cash_closure_details'
    ];

    for (const table of tables) {
      const [rows] = await db.promise().query(`DESCRIBE ${table}`);
      console.log(`📋 Tabla ${table}:`);
      
      if (table === 'orders') {
        // Solo mostrar las nuevas columnas de orders
        const newColumns = rows.filter(row => 
          ['messenger_status', 'delivery_attempts', 'requires_payment', 'payment_amount', 'delivery_fee'].includes(row.Field)
        );
        newColumns.forEach(col => {
          console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
        });
      } else {
        // Mostrar primeras 5 columnas de las nuevas tablas
        rows.slice(0, 5).forEach(col => {
          console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
        });
        if (rows.length > 5) {
          console.log(`   ... y ${rows.length - 5} columnas más`);
        }
      }
      console.log('');
    }

    // Verificar datos iniciales
    console.log('📊 Verificando datos iniciales...\n');
    
    const [orderCount] = await db.promise().query(
      "SELECT COUNT(*) as total, messenger_status, COUNT(*) as count FROM orders GROUP BY messenger_status"
    );
    
    console.log('📈 Estado de pedidos por messenger_status:');
    orderCount.forEach(row => {
      console.log(`   - ${row.messenger_status || 'NULL'}: ${row.count} pedidos`);
    });

    console.log('\n🎉 SISTEMA DE ENTREGAS CONFIGURADO EXITOSAMENTE');
    console.log('\n📋 Funcionalidades disponibles:');
    console.log('   ✅ Tracking detallado de entregas');
    console.log('   ✅ Sistema de evidencias fotográficas');
    console.log('   ✅ Cierre de caja para mensajeros');
    console.log('   ✅ Estados de entrega granulares');
    console.log('   ✅ Información de pagos y domicilios');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    console.error('\nDetalles del error:');
    console.error('- Mensaje:', error.message);
    console.error('- Código:', error.code);
    console.error('- SQL State:', error.sqlState);
  } finally {
    db.end();
  }
}

runMigration();
