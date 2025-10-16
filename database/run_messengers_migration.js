const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev',
  multipleStatements: true
};

async function runMessengersMigration() {
  let connection;
  
  try {
    console.log('🚀 Iniciando migración del sistema de mensajeros...');
    
    // Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos');
    
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'create_messengers_system.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📋 Ejecutando migración del sistema de mensajeros...');
    
    // Ejecutar las consultas SQL
    const queries = sqlContent.split(';').filter(query => query.trim().length > 0);
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i].trim();
      if (query) {
        try {
          console.log(`⏳ Ejecutando consulta ${i + 1}/${queries.length}...`);
          await connection.execute(query);
        } catch (error) {
          // Ignorar errores de duplicados o elementos ya existentes
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_KEYNAME' ||
              error.code === 'ER_DUP_ENTRY' ||
              error.message.includes('Duplicate column name') ||
              error.message.includes('already exists')) {
            console.log(`⚠️ Elemento ya existente (ignorando): ${error.message.substring(0, 100)}...`);
            continue;
          }
          throw error;
        }
      }
    }
    
    console.log('✅ Sistema de mensajeros creado exitosamente');
    
    // Verificar que las tablas se crearon correctamente
    console.log('\n📊 Verificando estructura creada...');
    
    // Verificar tabla messengers
    const [messengers] = await connection.execute('SELECT COUNT(*) as count FROM messengers');
    console.log(`📦 Mensajeros registrados: ${messengers[0].count}`);
    
    // Verificar tabla delivery_zones
    const [zones] = await connection.execute('SELECT COUNT(*) as count FROM delivery_zones');
    console.log(`🗺️ Zonas de entrega: ${zones[0].count}`);
    
    // Verificar tabla messenger_zones
    const [messengerZones] = await connection.execute('SELECT COUNT(*) as count FROM messenger_zones');
    console.log(`🔗 Asignaciones mensajero-zona: ${messengerZones[0].count}`);
    
    // Verificar que se agregaron las columnas a orders
    const [orderColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME IN ('assigned_messenger_id', 'delivery_notes', 'expected_delivery_date')
    `);
    console.log(`📋 Columnas agregadas a orders: ${orderColumns.length}/3`);
    
    // Mostrar mensajeros de ejemplo
    console.log('\n👥 Mensajeros de ejemplo creados:');
    const [exampleMessengers] = await connection.execute(`
      SELECT name, phone, transportation_type, commission_percentage 
      FROM messengers 
      WHERE is_active = true
    `);
    
    exampleMessengers.forEach(messenger => {
      console.log(`  📧 ${messenger.name} - ${messenger.phone} (${messenger.transportation_type}) - ${messenger.commission_percentage}% comisión`);
    });
    
    // Mostrar zonas de entrega
    console.log('\n🗺️ Zonas de entrega disponibles:');
    const [deliveryZones] = await connection.execute(`
      SELECT name, description, base_delivery_cost 
      FROM delivery_zones 
      WHERE is_active = true
    `);
    
    deliveryZones.forEach(zone => {
      console.log(`  📍 ${zone.name}: ${zone.description} - $${zone.base_delivery_cost.toLocaleString()}`);
    });
    
    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('\n📋 Próximos pasos:');
    console.log('1. Reiniciar el backend para cargar las nuevas rutas');
    console.log('2. Acceder a la sección de Administración > Mensajeros');
    console.log('3. En Logística, al seleccionar "Mensajería Local" aparecerá la lista de mensajeros');
    console.log('4. Los mensajeros podrán recibir entregas y cobrar dinero');
    console.log('5. El sistema integrará automáticamente con cartera');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión a la base de datos cerrada');
    }
  }
}

// Ejecutar la migración
runMessengersMigration();
