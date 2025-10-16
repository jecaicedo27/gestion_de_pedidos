// Fix directo para el problema de escaneo múltiple sin crear nuevas tablas
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
});

async function fixBarcodeScanning() {
  console.log('🔧 SOLUCIONANDO ESCANEO MÚLTIPLE DIRECTAMENTE');
  console.log('===============================================\n');

  try {
    // 1. Agregar solo las columnas necesarias a la tabla existente
    console.log('1. 📊 Agregando columnas para conteo de escaneos...');
    
    try {
      await connection.promise().execute(`
        ALTER TABLE packaging_item_verifications 
        ADD COLUMN IF NOT EXISTS scanned_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS required_scans INT DEFAULT 1
      `);
      console.log('✅ Columnas agregadas exitosamente');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('✅ Columnas ya existen');
      } else {
        throw error;
      }
    }

    // 2. Crear una tabla simple para tracking de escaneos individuales
    console.log('\n2. 🗃️ Creando tabla simple para tracking...');
    
    await connection.promise().execute(`
      CREATE TABLE IF NOT EXISTS simple_barcode_scans (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        item_id INT NOT NULL,
        barcode_scanned VARCHAR(200),
        scan_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_order_item (order_id, item_id)
      )
    `);
    console.log('✅ Tabla simple_barcode_scans creada');

    // 3. Actualizar registros existentes para establecer required_scans
    console.log('\n3. 🔄 Actualizando registros existentes...');
    
    await connection.promise().execute(`
      UPDATE packaging_item_verifications piv
      JOIN order_items oi ON piv.item_id = oi.id
      SET piv.required_scans = GREATEST(1, FLOOR(oi.quantity)),
          piv.scanned_count = CASE 
            WHEN piv.is_verified = 1 AND piv.required_scans > 1 THEN piv.required_scans 
            WHEN piv.is_verified = 1 THEN 1
            ELSE 0 
          END
      WHERE piv.required_scans IS NULL OR piv.required_scans = 0
    `);
    
    console.log('✅ Registros existentes actualizados');

    // 4. Verificar algunos registros como ejemplo
    console.log('\n4. 📋 Verificando registros actualizados...');
    
    const [testRecords] = await connection.promise().query(`
      SELECT 
        o.order_number,
        oi.name as item_name,
        oi.quantity as required_qty,
        piv.required_scans,
        piv.scanned_count,
        piv.is_verified
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id
      WHERE o.status IN ('en_empaque', 'en_preparacion')
      ORDER BY o.id DESC
      LIMIT 10
    `);

    console.log(`✅ ${testRecords.length} registros de ejemplo:`);
    testRecords.forEach(record => {
      console.log(`   - ${record.item_name}: ${record.scanned_count}/${record.required_scans} escaneos (Req: ${record.required_qty})`);
    });

    console.log('\n🎉 ARREGLO COMPLETADO');
    console.log('=====================================');
    console.log('✅ Sistema preparado para escaneo múltiple');
    console.log('✅ Tracking de escaneos individuales habilitado');
    console.log('✅ Compatibilidad con registros existentes');
    console.log('\n📋 SIGUIENTE PASO: Actualizar controlador backend');

  } catch (error) {
    console.error('❌ Error en el arreglo:', error.message);
    throw error;
  } finally {
    connection.end();
  }
}

fixBarcodeScanning();
