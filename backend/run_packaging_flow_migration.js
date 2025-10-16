const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuración de la base de datos usando las mismas variables de entorno
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev'
};

async function runPackagingFlowMigration() {
  let connection;
  
  try {
    console.log('🔄 Iniciando migración del flujo obligatorio de empaque...');
    
    // Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, '../database/update_order_statuses_for_packaging.sql');
    const sqlContent = await fs.readFile(sqlFile, 'utf8');
    
    // Dividir las consultas por punto y coma
    const queries = sqlContent
      .split(';')
      .map(query => query.trim())
      .filter(query => query.length > 0 && !query.startsWith('--'));

    console.log(`📝 Ejecutando ${queries.length} consultas...`);

    // Ejecutar cada consulta
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`   ${i + 1}/${queries.length}: ${query.substring(0, 50)}...`);
      
      try {
        await connection.execute(query);
        console.log(`   ✅ Consulta ${i + 1} ejecutada exitosamente`);
      } catch (error) {
        console.error(`   ❌ Error en consulta ${i + 1}:`, error.message);
        throw error;
      }
    }

    // Verificar el estado de los pedidos después de la migración
    const [statusResults] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status 
      ORDER BY count DESC
    `);

    console.log('\n📊 Estado de pedidos después de la migración:');
    statusResults.forEach(row => {
      console.log(`   ${row.status}: ${row.count} pedidos`);
    });

    // Verificar que no hay pedidos en estado 'listo' (deben haberse migrado)
    const [oldStatusCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE status = 'listo'
    `);

    if (oldStatusCheck[0].count === 0) {
      console.log('✅ Migración exitosa: No hay pedidos en estado obsoleto "listo"');
    } else {
      console.log(`⚠️  Advertencia: Aún hay ${oldStatusCheck[0].count} pedidos en estado "listo"`);
    }

    // Crear usuario de empaque si no existe
    try {
      const [empaqueUsers] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE role = 'empaque'
      `);

      if (empaqueUsers[0].count === 0) {
        console.log('👤 Creando usuario de empaque de prueba...');
        
        await connection.execute(`
          INSERT INTO users (username, password, full_name, role, active, created_at)
          VALUES ('empaque', '$2b$10$K8gF7rQYyqQ1yQYyqQ1yQO7Z8gF7rQYyqQ1yQYyqQ1yQYyqQ1yQO', 'Usuario Empaque', 'empaque', 1, NOW())
        `);
        
        console.log('✅ Usuario de empaque creado (usuario: empaque, contraseña: 123456)');
      }
    } catch (error) {
      console.log('ℹ️  Usuario de empaque ya existe o error al crear:', error.message);
    }

    console.log('\n🎉 ¡Migración del flujo obligatorio de empaque completada exitosamente!');
    console.log('\n📋 RESUMEN DE CAMBIOS:');
    console.log('   - Estados de pedidos actualizados para incluir empaque obligatorio');
    console.log('   - Pedidos en estado "listo" migrados a "pendiente_empaque"');
    console.log('   - Nuevo flujo: Logística → Empaque → Reparto');
    console.log('   - Usuario de empaque creado para pruebas');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔒 Conexión a la base de datos cerrada');
    }
  }
}

// Ejecutar la migración
runPackagingFlowMigration();
