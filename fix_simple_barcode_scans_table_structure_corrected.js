const mysql = require('mysql2/promise');

// Configuración de base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

console.log('🔧 ARREGLANDO: Estructura de tabla simple_barcode_scans (CORREGIDO)');
console.log('='.repeat(70));

async function fixBarcodeScansTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos');

    // 1. Verificar estructura actual
    console.log('\n📋 PASO 1: Verificando estructura actual...');
    
    const [columns] = await connection.execute(`
      DESCRIBE simple_barcode_scans
    `);
    
    console.log('   Columnas actuales:');
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    // 2. Renombrar columnas para consistencia si es necesario
    console.log('\n🔧 PASO 2: Renombrando columnas para consistencia...');
    
    const hasBarcodeScanned = columns.some(col => col.Field === 'barcode_scanned');
    const hasBarcode = columns.some(col => col.Field === 'barcode');
    
    if (hasBarcodeScanned && !hasBarcode) {
      await connection.execute(`
        ALTER TABLE simple_barcode_scans 
        CHANGE COLUMN barcode_scanned barcode VARCHAR(255) NULL
      `);
      console.log('✅ Columna barcode_scanned → barcode');
    }
    
    const hasScanTimestamp = columns.some(col => col.Field === 'scan_timestamp');
    const hasScannedAt = columns.some(col => col.Field === 'scanned_at');
    
    if (hasScanTimestamp && !hasScannedAt) {
      await connection.execute(`
        ALTER TABLE simple_barcode_scans 
        CHANGE COLUMN scan_timestamp scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ Columna scan_timestamp → scanned_at');
    }

    // 3. Agregar columnas faltantes
    console.log('\n🔧 PASO 3: Agregando columnas faltantes...');
    
    // Refrescar la lista de columnas después de los cambios
    const [updatedColumns] = await connection.execute(`
      DESCRIBE simple_barcode_scans
    `);
    
    const hasScanNumber = updatedColumns.some(col => col.Field === 'scan_number');
    if (!hasScanNumber) {
      await connection.execute(`
        ALTER TABLE simple_barcode_scans 
        ADD COLUMN scan_number INT NOT NULL DEFAULT 1 AFTER scanned_at
      `);
      console.log('✅ Columna scan_number agregada');
    } else {
      console.log('✅ Columna scan_number ya existe');
    }
    
    const hasCreatedAt = updatedColumns.some(col => col.Field === 'created_at');
    if (!hasCreatedAt) {
      await connection.execute(`
        ALTER TABLE simple_barcode_scans 
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ Columna created_at agregada');
    } else {
      console.log('✅ Columna created_at ya existe');
    }

    // 4. Actualizar el campo barcode para que sea NOT NULL
    console.log('\n🔧 PASO 4: Actualizando restricciones de columnas...');
    
    await connection.execute(`
      ALTER TABLE simple_barcode_scans 
      MODIFY COLUMN barcode VARCHAR(255) NOT NULL
    `);
    console.log('✅ Columna barcode actualizada a NOT NULL');

    // 5. Verificar y crear índices necesarios
    console.log('\n🔧 PASO 5: Verificando índices...');
    
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM simple_barcode_scans
    `);
    
    const hasOrderItemIndex = indexes.some(idx => idx.Key_name === 'idx_order_item');
    if (!hasOrderItemIndex) {
      await connection.execute(`
        ALTER TABLE simple_barcode_scans 
        ADD INDEX idx_order_item (order_id, item_id)
      `);
      console.log('✅ Índice idx_order_item creado');
    } else {
      console.log('✅ Índice idx_order_item ya existe');
    }
    
    const hasBarcodeIndex = indexes.some(idx => idx.Key_name === 'idx_barcode');
    if (!hasBarcodeIndex) {
      await connection.execute(`
        ALTER TABLE simple_barcode_scans 
        ADD INDEX idx_barcode (barcode)
      `);
      console.log('✅ Índice idx_barcode creado');
    } else {
      console.log('✅ Índice idx_barcode ya existe');
    }

    // 6. Verificar estructura final
    console.log('\n📋 PASO 6: Verificando estructura final...');
    
    const [finalColumns] = await connection.execute(`
      DESCRIBE simple_barcode_scans
    `);
    
    console.log('✅ Estructura final de simple_barcode_scans:');
    finalColumns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });

    // 7. Verificar índices finales
    console.log('\n📋 PASO 7: Verificando índices finales...');
    
    const [finalIndexes] = await connection.execute(`
      SHOW INDEX FROM simple_barcode_scans
    `);
    
    console.log('   Índices existentes:');
    finalIndexes.forEach(idx => {
      console.log(`   - ${idx.Key_name} en ${idx.Column_name} (${idx.Index_type})`);
    });

    console.log('\n🎉 ESTRUCTURA CORREGIDA EXITOSAMENTE');
    console.log('   ✅ Tabla simple_barcode_scans lista para usar');
    console.log('   ✅ Todas las columnas necesarias están presentes');
    console.log('   ✅ Nombres de columnas consistentes con el código backend');
    console.log('   ✅ Índices configurados correctamente');

  } catch (error) {
    console.error('❌ Error corrigiendo estructura:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixBarcodeScansTable().catch(console.error);
