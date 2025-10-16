const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runDeliveryMethodsMigration() {
  let connection;

  try {
    // Crear conexión a la base de datos
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    console.log('🔗 Conectado a la base de datos MySQL');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'create_delivery_methods_system.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Dividir las consultas por punto y coma
    const queries = sqlContent.split(';').filter(query => query.trim().length > 0);

    console.log(`📄 Ejecutando ${queries.length} consultas...`);

    // Ejecutar cada consulta
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i].trim();
      if (query) {
        console.log(`⚡ Ejecutando consulta ${i + 1}/${queries.length}...`);
        await connection.execute(query);
      }
    }

    // Verificar que los datos se insertaron correctamente
    const [rows] = await connection.execute('SELECT * FROM delivery_methods ORDER BY sort_order');
    console.log('\n✅ Métodos de envío creados:');
    rows.forEach(method => {
      console.log(`   - ${method.name} (${method.code}) - ${method.active ? 'Activo' : 'Inactivo'}`);
    });

    console.log('\n🎉 ¡Migración de métodos de envío completada exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   • Tabla delivery_methods creada`);
    console.log(`   • ${rows.length} métodos de envío por defecto insertados`);

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    console.error('📍 Stack trace completo:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión a la base de datos cerrada');
    }
  }
}

// Ejecutar la migración
runDeliveryMethodsMigration();
