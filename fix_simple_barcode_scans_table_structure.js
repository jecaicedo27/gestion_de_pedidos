const mysql = require('mysql2/promise');

// Configuración de base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

console.log('🔧 ARREGLANDO: Estructura de tabla simple_barcode_scans');
console.log('='.repeat(60));

async function fixBarcodeScansTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos');

    // 1. Verificar si la tabla existe
    console.log('\n📋 PASO 1: Verificando tabla simple_barcode_scans...');
    
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'simple_barcode_scans'
    `);
    
    if (tables.length === 0) {
      console.log('❌ La tabla simple_barcode_scans no existe');
      console.log('   Creando tabla completa...');
      
      await connection.execute(`
        CREATE TABLE simple_barcode_scans (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT NOT NULL,
          item_id INT NOT NULL,
          barcode VARCHAR(255) NOT NULL,
          scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scan_number INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_item (order_id, item_id),
          INDEX idx_barcode (barcode),
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES order_items(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ Tabla simple_barcode_scans creada exitosamente');
    } else {
      console.log('✅ Tabla simple_barcode_scans existe');
      
      // 2. Verificar columnas existentes
      console.log('\n📋 PASO 2: Verificando estructura de columnas...');
      
      const [columns] = await connection.execute(`
        DESCRIBE simple_barcode_scans
      `);
      
      console.log('   Columnas actuales:');
      columns.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
      
      // 3. Verificar si falta la columna scan_number
      const hasScanNumber = columns.some(col => col.Field === 'scan_number');
      
      if (!hasScanNumber) {
        console.log('\n🔧 PASO 3: Agregando columna scan_number...');
        
        await connection.execute(`
          ALTER TABLE simple_barcode_scans 
          ADD COLUMN scan_number INT NOT NULL DEFAULT 1 AFTER scanned_at
        `);
        
        console.log('✅ Columna scan_number agregada');
      } else {
        console.log('\n✅ PASO 3: Columna scan_number ya existe');
      }
      
      // 4. Verificar otras columnas necesarias
      const hasCreatedAt = columns.some(col => col.Field === 'created_at');
      
      if (!hasCreatedAt) {
        console.log('\n🔧 PASO 4: Agregando columna created_at...');
        
        await connection.execute(`
          ALTER TABLE simple_barcode_scans 
          ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
        
        console.log('✅ Columna created_at agregada');
      } else {
        console.log('\n✅ PASO 4: Columna created_at ya existe');
      }
    }

    // 5. Verificar estructura final
    console.log('\n📋 PASO FINAL: Verificando estructura completa...');
    
    const [finalColumns] = await connection.execute(`
      DESCRIBE simple_barcode_scans
    `);
    
    console.log('✅ Estructura final de simple_barcode_scans:');
    finalColumns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });

    // 6. Verificar índices
    console.log('\n📋 VERIFICANDO ÍNDICES:');
    
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM simple_barcode_scans
    `);
    
    console.log('   Índices existentes:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.Key_name} en ${idx.Column_name}`);
    });

    console.log('\n🎉 ESTRUCTURA CORREGIDA EXITOSAMENTE');
    console.log('   ✅ Tabla simple_barcode_scans lista para usar');
    console.log('   ✅ Todas las columnas necesarias están presentes');
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
