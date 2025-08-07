const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runDeliveryMethodsColumnMigration() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    console.log('=== EJECUTANDO MIGRACIÓN: AGREGAR COLUMNA DELIVERY_METHODS ===');
    
    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'add_delivery_methods_column.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Separar las consultas SQL
    const queries = sqlContent
      .split(';')
      .map(query => query.trim())
      .filter(query => query.length > 0 && !query.startsWith('--'));
    
    console.log(`Ejecutando ${queries.length} consultas...`);
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      if (query.trim()) {
        console.log(`\n${i + 1}. Ejecutando: ${query.substring(0, 50)}...`);
        
        try {
          const [result] = await connection.execute(query);
          
          if (query.toLowerCase().includes('describe')) {
            console.log('\n=== ESTRUCTURA ACTUALIZADA DE LA TABLA ORDERS ===');
            result.forEach(col => {
              const highlight = col.Field === 'delivery_methods' ? '>>> ' : '    ';
              console.log(`${highlight}${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key || ''}`);
            });
          } else {
            console.log('✅ Consulta ejecutada exitosamente');
          }
        } catch (error) {
          console.error(`❌ Error en consulta ${i + 1}:`, error.message);
        }
      }
    }
    
    console.log('\n=== VERIFICANDO COLUMNA DELIVERY_METHODS ===');
    
    // Verificar que la columna se agregó correctamente
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
       AND TABLE_NAME = 'orders' 
       AND COLUMN_NAME = 'delivery_methods'`
    );
    
    if (columns.length > 0) {
      const col = columns[0];
      console.log('✅ Columna delivery_methods agregada exitosamente:');
      console.log(`   Nombre: ${col.COLUMN_NAME}`);
      console.log(`   Tipo: ${col.DATA_TYPE}`);
      console.log(`   Nullable: ${col.IS_NULLABLE}`);
      console.log(`   Default: ${col.COLUMN_DEFAULT || 'NULL'}`);
      console.log(`   Comentario: ${col.COLUMN_COMMENT}`);
    } else {
      console.log('❌ Error: La columna delivery_methods no se encontró');
    }
    
    await connection.end();
    console.log('\n✅ Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
  }
}

runDeliveryMethodsColumnMigration();
