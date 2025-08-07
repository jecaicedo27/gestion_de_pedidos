const { pool } = require('../backend/config/database');
const fs = require('fs');
const path = require('path');

async function runSystemStartDateMigration() {
  console.log('🗄️ Ejecutando migración de fecha de inicio del sistema...');
  
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'create_system_start_date.sql');
    const sqlScript = fs.readFileSync(sqlFile, 'utf8');
    
    // Dividir el script en declaraciones individuales
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Ejecutando ${statements.length} declaraciones SQL...`);
    
    // Ejecutar cada declaración
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.toLowerCase().includes('select')) {
        // Para declaraciones SELECT, mostrar el resultado
        const [rows] = await connection.execute(statement);
        if (rows.length > 0) {
          console.log(`✅ ${rows[0].message || 'Declaración ejecutada exitosamente'}`);
        }
      } else {
        // Para otras declaraciones, solo ejecutar
        await connection.execute(statement);
        console.log(`✅ Declaración ${i + 1} ejecutada exitosamente`);
      }
    }
    
    // Verificar que las configuraciones se crearon correctamente
    console.log('\n🔍 Verificando configuraciones creadas...');
    
    const [configs] = await connection.execute(`
      SELECT config_key, config_value, description, data_type 
      FROM system_config 
      WHERE config_key LIKE 'siigo_%'
      ORDER BY config_key
    `);
    
    console.log('\n📋 Configuraciones del sistema SIIGO:');
    configs.forEach(config => {
      console.log(`  • ${config.config_key}: ${config.config_value} (${config.data_type})`);
      console.log(`    ${config.description}`);
    });
    
    console.log('\n✅ Migración de fecha de inicio del sistema completada exitosamente!');
    console.log('\n📌 Próximos pasos:');
    console.log('1. El admin puede configurar la fecha de inicio desde la interfaz');
    console.log('2. Solo se importarán facturas SIIGO desde esa fecha en adelante');
    console.log('3. Las facturas anteriores no se mostrarán en la lista de importación');
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runSystemStartDateMigration()
    .then(() => {
      console.log('\n🎉 Migración completada!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Error en migración:', error);
      process.exit(1);
    });
}

module.exports = runSystemStartDateMigration;
