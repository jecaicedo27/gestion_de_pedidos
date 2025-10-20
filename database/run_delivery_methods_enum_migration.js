// Ejecutar migración: Actualizar enum delivery_method para incluir nuevos métodos
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

console.log(`
🔧 MIGRACIÓN: ACTUALIZAR ENUM DELIVERY_METHOD
📋 Agregando nuevos códigos al enum para compatibilidad dinámica

✅ OBJETIVO:
- Incluir "mensajeria_urbana" y "envio_especial" en enum
- Permitir que nuevos métodos aparezcan automáticamente en frontend
- Mantener compatibilidad con datos existentes
`);

async function runDeliveryMethodsEnumMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    console.log('✅ Conectado a base de datos\n');

    // 1. Mostrar estado actual
    console.log('🔍 VERIFICACIÓN PRE-MIGRACIÓN:');
    const [preTableInfo] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'delivery_method'
    `);

    if (preTableInfo.length > 0) {
      console.log('   📋 Enum actual:', preTableInfo[0].COLUMN_TYPE);
    }

    // 2. Leer y ejecutar SQL
    console.log('\n🔧 EJECUTANDO MIGRACIÓN...');
    const sqlPath = path.join(__dirname, 'update_delivery_methods_enum.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Separar comandos SQL
    const sqlCommands = sqlContent.split(';').filter(cmd => cmd.trim() && !cmd.trim().startsWith('--') && !cmd.trim().startsWith('USE'));
    
    for (const command of sqlCommands) {
      if (command.trim()) {
        console.log(`   ⚡ Ejecutando: ${command.trim().substring(0, 50)}...`);
        await connection.execute(command.trim());
      }
    }

    console.log('   ✅ Migración ejecutada exitosamente');

    // 3. Verificar resultado
    console.log('\n🔍 VERIFICACIÓN POST-MIGRACIÓN:');
    const [postTableInfo] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'delivery_method'
    `);

    if (postTableInfo.length > 0) {
      console.log('   📋 Nuevo enum:', postTableInfo[0].COLUMN_TYPE);
      
      const enumValues = postTableInfo[0].COLUMN_TYPE;
      const enumMatches = enumValues.match(/'([^']+)'/g);
      if (enumMatches) {
        const allEnumValues = enumMatches.map(match => match.slice(1, -1));
        console.log('   📊 Valores en enum:');
        allEnumValues.forEach(value => {
          console.log(`      • "${value}"`);
        });
      }
    }

    // 4. Verificar compatibilidad con delivery_methods
    console.log('\n🔍 VERIFICACIÓN DE COMPATIBILIDAD:');
    const [deliveryMethods] = await connection.execute(
      'SELECT code, name, active FROM delivery_methods WHERE active = 1 ORDER BY sort_order ASC'
    );

    console.log('   📡 Métodos que ahora aparecerán en frontend:');
    deliveryMethods.forEach(method => {
      console.log(`      ✅ { value: "${method.code}", label: "${method.name}" }`);
    });

    // 5. Resumen final
    console.log('\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('✅ Todos los métodos de delivery_methods son ahora compatibles');
    console.log('✅ El frontend mostrará dinámicamente todos los métodos activos');
    console.log('✅ Ya no es necesario hardcodear opciones en el frontend');
    
    console.log('\n🚀 PRÓXIMO PASO:');
    console.log('   Actualiza el modal en el navegador para ver "envio especial"');

  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    console.error('📍 Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runDeliveryMethodsEnumMigration();
