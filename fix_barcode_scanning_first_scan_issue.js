const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function fixBarcodeScannissingFirstScanIssue() {
  let connection;
  
  try {
    console.log('🔧 DIAGNÓSTICO Y CORRECCIÓN: Problema de primer escaneo en empaque');
    console.log('=====================================');
    
    connection = await mysql.createConnection(dbConfig);
    
    // 1. Verificar estructura de tabla de verificaciones de empaque
    console.log('\n📋 1. Verificando estructura de packaging_item_verifications...');
    const [tableStructure] = await connection.execute(`
      DESCRIBE packaging_item_verifications
    `);
    
    console.log('Columnas existentes:');
    tableStructure.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // 2. Verificar si faltan columnas importantes
    const requiredColumns = ['scanned_count', 'required_scans'];
    const existingColumns = tableStructure.map(col => col.Field);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('\n❌ PROBLEMA ENCONTRADO: Faltan columnas importantes');
      console.log('Columnas faltantes:', missingColumns);
      
      for (const column of missingColumns) {
        if (column === 'scanned_count') {
          console.log('📝 Agregando columna scanned_count...');
          await connection.execute(`
            ALTER TABLE packaging_item_verifications 
            ADD COLUMN scanned_count INT DEFAULT 0 AFTER packed_size
          `);
        }
        
        if (column === 'required_scans') {
          console.log('📝 Agregando columna required_scans...');
          await connection.execute(`
            ALTER TABLE packaging_item_verifications 
            ADD COLUMN required_scans INT DEFAULT 1 AFTER scanned_count
          `);
        }
      }
      
      console.log('✅ Columnas agregadas exitosamente');
    } else {
      console.log('✅ Todas las columnas requeridas existen');
    }
    
    // 3. Verificar tabla simple_barcode_scans
    console.log('\n📋 2. Verificando tabla simple_barcode_scans...');
    try {
      const [scanTableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM simple_barcode_scans LIMIT 1
      `);
      console.log('✅ Tabla simple_barcode_scans existe');
    } catch (error) {
      console.log('❌ Tabla simple_barcode_scans no existe, creándola...');
      
      await connection.execute(`
        CREATE TABLE simple_barcode_scans (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          item_id INT NOT NULL,
          barcode VARCHAR(255) NOT NULL,
          scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scan_number INT NOT NULL,
          INDEX idx_order_item (order_id, item_id),
          INDEX idx_barcode (barcode),
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES order_items(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
      
      console.log('✅ Tabla simple_barcode_scans creada');
    }
    
    // 4. Buscar pedidos con items de múltiples unidades para testing
    console.log('\n📋 3. Buscando pedidos con items de múltiples unidades...');
    const [multipleItemsOrders] = await connection.execute(`
      SELECT DISTINCT
        o.id as order_id,
        o.order_number,
        o.status,
        COUNT(oi.id) as total_items,
        SUM(CASE WHEN oi.quantity > 1 THEN 1 ELSE 0 END) as multiple_unit_items
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status IN ('en_empaque', 'en_preparacion') 
        AND oi.quantity > 1
      GROUP BY o.id
      HAVING multiple_unit_items > 0
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    
    if (multipleItemsOrders.length > 0) {
      console.log('📦 Pedidos encontrados con items de múltiples unidades:');
      multipleItemsOrders.forEach(order => {
        console.log(`  - Pedido ${order.order_number} (ID: ${order.order_id}): ${order.multiple_unit_items} items con cantidad > 1`);
      });
    } else {
      console.log('⚠️ No se encontraron pedidos activos con items de múltiples unidades');
    }
    
    // 5. Verificar estado actual de verificaciones
    console.log('\n📋 4. Verificando estado actual de verificaciones...');
    const [currentVerifications] = await connection.execute(`
      SELECT 
        piv.order_id,
        piv.item_id,
        oi.name,
        oi.quantity as required_quantity,
        piv.scanned_count,
        piv.required_scans,
        piv.is_verified,
        piv.verification_notes
      FROM packaging_item_verifications piv
      JOIN order_items oi ON piv.item_id = oi.id
      WHERE oi.quantity > 1
      ORDER BY piv.updated_at DESC
      LIMIT 10
    `);
    
    if (currentVerifications.length > 0) {
      console.log('🔍 Verificaciones existentes para items múltiples:');
      currentVerifications.forEach(v => {
        console.log(`  - ${v.name} (${v.required_quantity} unid): ${v.scanned_count}/${v.required_scans} escaneos, verificado: ${v.is_verified ? 'SÍ' : 'NO'}`);
      });
    } else {
      console.log('ℹ️ No hay verificaciones registradas para items múltiples');
    }
    
    // 6. Verificar productos con códigos de barras
    console.log('\n📋 5. Verificando productos con códigos de barras...');
    const [productsWithBarcodes] = await connection.execute(`
      SELECT 
        p.id,
        p.product_name,
        p.barcode,
        p.internal_code,
        COUNT(oi.id) as times_ordered
      FROM products p
      LEFT JOIN order_items oi ON LOWER(TRIM(p.product_name)) = LOWER(TRIM(oi.name))
      WHERE p.barcode IS NOT NULL AND p.barcode != ''
      GROUP BY p.id
      ORDER BY times_ordered DESC
      LIMIT 10
    `);
    
    console.log('📊 Productos con códigos de barras más ordenados:');
    productsWithBarcodes.forEach(p => {
      console.log(`  - ${p.product_name}: ${p.barcode} (${p.times_ordered} pedidos)`);
    });
    
    // 7. Inicializar correctamente verificaciones para items existentes
    console.log('\n🔧 6. Inicializando verificaciones para items de múltiples unidades...');
    
    // Obtener items de múltiples unidades que no tengan verificación inicializada
    const [uninitializedItems] = await connection.execute(`
      SELECT 
        oi.id as item_id,
        oi.order_id,
        oi.name,
        oi.quantity,
        o.status
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND oi.order_id = piv.order_id
      WHERE oi.quantity > 1 
        AND o.status IN ('en_empaque', 'en_preparacion')
        AND piv.id IS NULL
      LIMIT 20
    `);
    
    console.log(`📝 Encontrados ${uninitializedItems.length} items de múltiples unidades sin inicializar`);
    
    let initializedCount = 0;
    for (const item of uninitializedItems) {
      try {
        await connection.execute(`
          INSERT INTO packaging_item_verifications 
          (order_id, item_id, scanned_count, required_scans, packed_quantity, verification_notes, is_verified, verified_by)
          VALUES (?, ?, 0, ?, ?, ?, FALSE, 'sistema_inicializado')
        `, [
          item.order_id,
          item.item_id,
          item.quantity,
          item.quantity,
          `Inicializado para escaneo múltiple: ${item.quantity} unidades de ${item.name}`
        ]);
        
        initializedCount++;
        console.log(`  ✅ Inicializado: ${item.name} (${item.quantity} unidades) en pedido ${item.order_id}`);
        
      } catch (error) {
        console.log(`  ❌ Error inicializando item ${item.item_id}: ${error.message}`);
      }
    }
    
    console.log(`📊 Total de items inicializados: ${initializedCount}`);
    
    // 8. Crear un endpoint de testing
    console.log('\n🧪 7. Creando script de testing para escaneo múltiple...');
    
    const testScript = `
// SCRIPT DE TESTING PARA ESCANEO MÚLTIPLE
// =====================================

// Para probar el sistema de escaneo:
// 1. Ve a la página de empaque
// 2. Inicia el empaque de un pedido que tenga items con cantidad > 1
// 3. Usa el modo "Código de Barras"
// 4. Escanea o escribe un código de barras del producto
// 5. Verifica que se muestre el progreso: "1/X unidades escaneadas"

// Endpoints de API para debug:
// GET /api/packaging/checklist/:orderId - Ver estado actual
// POST /api/packaging/verify-barcode/:orderId - Escanear código

// Verificar en base de datos:
// SELECT * FROM packaging_item_verifications WHERE scanned_count > 0;
// SELECT * FROM simple_barcode_scans ORDER BY scanned_at DESC LIMIT 10;

console.log('Sistema de escaneo múltiple listo para testing');
    `;
    
    // 9. Mostrar resumen de la corrección
    console.log('\n✅ CORRECCIÓN COMPLETADA');
    console.log('========================');
    console.log('🔧 Problemas solucionados:');
    console.log('  ✓ Estructura de tablas verificada y corregida');
    console.log('  ✓ Columnas scanned_count y required_scans disponibles');
    console.log('  ✓ Tabla simple_barcode_scans creada/verificada');
    console.log(`  ✓ ${initializedCount} items de múltiples unidades inicializados`);
    
    console.log('\n📋 Próximos pasos:');
    console.log('  1. Reiniciar el backend para aplicar cambios');
    console.log('  2. Probar el escaneo en un pedido con items de múltiples unidades');
    console.log('  3. Verificar que el primer escaneo se registre correctamente');
    console.log('  4. Confirmar que se muestre el progreso X/Y unidades');
    
    // 10. Crear pedido de prueba si no existe uno
    if (multipleItemsOrders.length === 0) {
      console.log('\n🧪 8. Creando pedido de prueba para testing...');
      
      // Buscar un producto con código de barras
      const [testProduct] = await connection.execute(`
        SELECT id, product_name, barcode, internal_code 
        FROM products 
        WHERE (barcode IS NOT NULL AND barcode != '') 
           OR (internal_code IS NOT NULL AND internal_code != '')
        LIMIT 1
      `);
      
      if (testProduct.length > 0) {
        const product = testProduct[0];
        
        // Crear pedido de prueba
        const [orderResult] = await connection.execute(`
          INSERT INTO orders 
          (order_number, customer_name, customer_phone, customer_email, customer_address, 
           status, total_amount, delivery_method, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'en_empaque', ?, 'domicilio_local', NOW(), NOW())
        `, [
          `TEST-${Date.now()}`,
          'Cliente Prueba Escaneo',
          '555-0123',
          'test@example.com',
          'Dirección de prueba 123',
          25000
        ]);
        
        const orderId = orderResult.insertId;
        
        // Crear item con múltiples unidades
        await connection.execute(`
          INSERT INTO order_items 
          (order_id, name, quantity, price, description, created_at, updated_at)
          VALUES (?, ?, 3, 8333.33, 'Item de prueba para escaneo múltiple', NOW(), NOW())
        `, [orderId, product.product_name]);
        
        console.log(`✅ Pedido de prueba creado: TEST-${Date.now()}`);
        console.log(`   - Producto: ${product.product_name}`);
        console.log(`   - Cantidad: 3 unidades`);
        console.log(`   - Código: ${product.barcode || product.internal_code}`);
        console.log(`   - Estado: en_empaque`);
        
      } else {
        console.log('⚠️ No se pudo crear pedido de prueba: sin productos con códigos');
      }
    }
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar la corrección
fixBarcodeScannissingFirstScanIssue().catch(console.error);
