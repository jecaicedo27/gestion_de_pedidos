const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  
  try {
    // Crear conexión a la base de datos
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    console.log('🔗 Conectado a la base de datos...');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'add_siigo_observations.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Ejecutar cada statement SQL por separado
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('alter table')) {
        console.log('📝 Ejecutando migración...');
        console.log(`SQL: ${statement.substring(0, 100)}...`);
        
        try {
          await connection.execute(statement);
          console.log('✅ Campo siigo_observations agregado exitosamente');
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  El campo siigo_observations ya existe, saltando...');
          } else {
            throw error;
          }
        }
      } else if (statement.toLowerCase().includes('describe')) {
        console.log('📋 Verificando estructura de la tabla...');
        const [rows] = await connection.execute(statement);
        
        // Buscar el campo siigo_observations
        const observationsField = rows.find(row => row.Field === 'siigo_observations');
        if (observationsField) {
          console.log('✅ Campo siigo_observations encontrado:');
          console.log(`   Tipo: ${observationsField.Type}`);
          console.log(`   Null: ${observationsField.Null}`);
          console.log(`   Default: ${observationsField.Default}`);
        } else {
          console.log('❌ Campo siigo_observations no encontrado');
        }
      }
    }

    console.log('🎉 Migración completada exitosamente!');

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la migración
runMigration();
