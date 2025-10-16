const mysql = require('mysql2/promise');

async function fixProductsTableForSiigoSync() {
  console.log('🔧 Arreglando estructura de tabla products para sincronización SIIGO...\n');

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    // 1. Verificar estructura actual
    console.log('1️⃣ Verificando estructura actual de la tabla products...');
    const [columns] = await connection.execute(`
      DESCRIBE products;
    `);

    console.log('📋 Columnas actuales:');
    columns.forEach(column => {
      console.log(`   • ${column.Field} - ${column.Type} ${column.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });

    // 2. Verificar si ya existen las columnas necesarias
    const existingColumns = columns.map(col => col.Field);
    const requiredColumns = [
      'siigo_id',
      'available_quantity', 
      'last_sync_at'
    ];

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('✅ Todas las columnas necesarias ya existen');
    } else {
      console.log(`\n2️⃣ Agregando columnas faltantes: ${missingColumns.join(', ')}`);
      
      // Agregar columnas faltantes
      for (const column of missingColumns) {
        let alterQuery = '';
        
        switch (column) {
          case 'siigo_id':
            alterQuery = 'ALTER TABLE products ADD COLUMN siigo_id VARCHAR(255) NULL COMMENT "ID del producto en SIIGO"';
            break;
          case 'available_quantity':
            alterQuery = 'ALTER TABLE products ADD COLUMN available_quantity INT DEFAULT 0 COMMENT "Cantidad disponible desde SIIGO"';
            break;
          case 'last_sync_at':
            alterQuery = 'ALTER TABLE products ADD COLUMN last_sync_at TIMESTAMP NULL COMMENT "Última sincronización con SIIGO"';
            break;
        }
        
        if (alterQuery) {
          console.log(`   Agregando columna ${column}...`);
          await connection.execute(alterQuery);
          console.log(`   ✅ ${column} agregada exitosamente`);
        }
      }
    }

    // 3. Crear índices para mejor rendimiento
    console.log('\n3️⃣ Creando índices...');
    try {
      await connection.execute('CREATE INDEX idx_siigo_id ON products(siigo_id)');
      console.log('✅ Índice para siigo_id creado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('📝 Índice para siigo_id ya existe');
      } else {
        console.log('⚠️ Error creando índice siigo_id:', error.message);
      }
    }

    try {
      await connection.execute('CREATE INDEX idx_available_quantity ON products(available_quantity)');
      console.log('✅ Índice para available_quantity creado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('📝 Índice para available_quantity ya existe');
      } else {
        console.log('⚠️ Error creando índice available_quantity:', error.message);
      }
    }

    // 4. Verificar estructura final
    console.log('\n4️⃣ Verificando estructura final...');
    const [finalColumns] = await connection.execute(`
      DESCRIBE products;
    `);

    console.log('📋 Estructura final:');
    finalColumns.forEach(column => {
      const isNew = requiredColumns.includes(column.Field);
      const status = isNew ? '🆕' : '📋';
      console.log(`   ${status} ${column.Field} - ${column.Type} ${column.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });

    // 5. Inicializar algunos valores de ejemplo
    console.log('\n5️⃣ Inicializando datos de sincronización...');
    
    // Actualizar available_quantity con el stock existente donde sea NULL
    const updateResult = await connection.execute(`
      UPDATE products 
      SET available_quantity = COALESCE(stock, 0) 
      WHERE available_quantity IS NULL
    `);
    
    console.log(`✅ ${updateResult[0].affectedRows} productos actualizados con available_quantity inicial`);

    await connection.end();

    console.log('\n🎉 ESTRUCTURA DE TABLA PRODUCTS ARREGLADA!');
    console.log('✅ Columnas SIIGO agregadas correctamente');
    console.log('✅ Índices creados para mejor rendimiento');
    console.log('✅ Datos inicializados');
    console.log('\n🚀 Ahora la sincronización con SIIGO debería funcionar correctamente');

  } catch (error) {
    console.error('❌ Error arreglando estructura:', error.message);
    console.log('\n🔧 Verifica:');
    console.log('   • Que MySQL esté corriendo');
    console.log('   • Que la base de datos gestion_pedidos_dev exista');
    console.log('   • Que tengas permisos para modificar la tabla');
  }
}

// Ejecutar arreglo
fixProductsTableForSiigoSync();
