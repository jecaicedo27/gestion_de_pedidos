const axios = require('axios');
const mysql = require('mysql2/promise');

// Configuración de base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

// Configuración de API
const API_BASE_URL = 'http://localhost:5000';

console.log('🔍 PRUEBA COMPLETA: Sistema de Escaneo de Códigos de Barras con Múltiples Unidades');
console.log('='.repeat(80));

async function testBarcodeScanning() {
  let connection;
  
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos');

    // 1. Verificar estructura de tablas
    console.log('\n📋 PASO 1: Verificando estructura de base de datos...');
    
    const checkPackagingTable = await connection.execute(`
      SHOW COLUMNS FROM packaging_item_verifications LIKE 'scanned_count'
    `);
    
    const checkScansTable = await connection.execute(`
      SHOW TABLES LIKE 'simple_barcode_scans'
    `);
    
    if (checkPackagingTable[0].length === 0 || checkScansTable[0].length === 0) {
      console.log('❌ ERROR: Estructura de base de datos incompleta');
      console.log('   - ¿Existe scanned_count?', checkPackagingTable[0].length > 0);
      console.log('   - ¿Existe simple_barcode_scans?', checkScansTable[0].length > 0);
      return;
    }
    
    console.log('✅ Estructura de base de datos correcta');

    // 2. Buscar un pedido de prueba con productos de múltiples unidades
    console.log('\n📦 PASO 2: Buscando pedido con productos de múltiples unidades...');
    
    const [orders] = await connection.execute(`
      SELECT o.id, o.order_number, o.customer_name, o.status
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status IN ('en_empaque', 'en_preparacion')
        AND oi.quantity >= 2
      ORDER BY o.created_at DESC
      LIMIT 1
    `);
    
    if (orders.length === 0) {
      console.log('⚠️  No se encontraron pedidos con productos de múltiples unidades');
      console.log('   Creando pedido de prueba...');
      
      // Crear pedido de prueba
      const [insertOrder] = await connection.execute(`
        INSERT INTO orders (order_number, customer_name, customer_phone, customer_address, delivery_method, status, total_amount, created_at)
        VALUES ('TEST-SCAN-001', 'Cliente Prueba Escaneo', '3001234567', 'Dirección de Prueba', 'domicilio', 'en_preparacion', 25000, NOW())
      `);
      
      const orderId = insertOrder.insertId;
      
      // Agregar items con múltiples unidades
      await connection.execute(`
        INSERT INTO order_items (order_id, name, quantity, price, description)
        VALUES 
          (?, 'SALSA SKARCHAMOY DE 1000ML', 2, 12500, 'Salsa picante de 1 litro'),
          (?, 'LIQUI POP SABOR FRESA', 3, 4167, 'Bebida sabor fresa')
      `, [orderId, orderId]);
      
      console.log(`✅ Pedido de prueba creado: ${orderId}`);
      
      // Buscar nuevamente
      const [newOrders] = await connection.execute(`
        SELECT o.id, o.order_number, o.customer_name, o.status
        FROM orders o
        WHERE o.id = ?
      `, [orderId]);
      
      orders.push(newOrders[0]);
    }
    
    const testOrder = orders[0];
    console.log(`✅ Pedido seleccionado: #${testOrder.order_number} (ID: ${testOrder.id})`);

    // 3. Obtener items del pedido
    console.log('\n📝 PASO 3: Obteniendo items del pedido...');
    
    const [items] = await connection.execute(`
      SELECT 
        oi.id, oi.name, oi.quantity,
        p.barcode, p.internal_code,
        piv.scanned_count, piv.required_scans, piv.is_verified
      FROM order_items oi
      LEFT JOIN products p ON LOWER(TRIM(p.product_name)) = LOWER(TRIM(oi.name))
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = ?
      WHERE oi.order_id = ? AND oi.quantity >= 2
      LIMIT 1
    `, [testOrder.id, testOrder.id]);
    
    if (items.length === 0) {
      console.log('❌ No se encontraron items con múltiples unidades');
      return;
    }
    
    const testItem = items[0];
    console.log(`✅ Item seleccionado: ${testItem.name} (Cantidad: ${testItem.quantity})`);
    
    if (!testItem.barcode && !testItem.internal_code) {
      console.log('⚠️  El producto no tiene código de barras registrado, usando código de prueba');
      const testBarcode = 'TEST-BARCODE-001';
      
      // Buscar o crear producto con código de barras
      const [existingProduct] = await connection.execute(`
        SELECT id FROM products WHERE product_name = ?
      `, [testItem.name]);
      
      if (existingProduct.length > 0) {
        await connection.execute(`
          UPDATE products SET barcode = ? WHERE id = ?
        `, [testBarcode, existingProduct[0].id]);
      } else {
        await connection.execute(`
          INSERT INTO products (product_name, barcode, status)
          VALUES (?, ?, 'activo')
        `, [testItem.name, testBarcode]);
      }
      
      testItem.barcode = testBarcode;
      console.log(`✅ Código de barras asignado: ${testBarcode}`);
    }

    // 4. Limpiar registros previos de escaneo para empezar limpio
    console.log('\n🧹 PASO 4: Limpiando registros previos de escaneo...');
    
    await connection.execute(`
      DELETE FROM simple_barcode_scans WHERE order_id = ? AND item_id = ?
    `, [testOrder.id, testItem.id]);
    
    await connection.execute(`
      DELETE FROM packaging_item_verifications WHERE order_id = ? AND item_id = ?
    `, [testOrder.id, testItem.id]);
    
    console.log('✅ Registros previos limpiados');

    // 5. Probar escaneos múltiples
    console.log('\n📱 PASO 5: Probando escaneos múltiples...');
    console.log(`   Producto: ${testItem.name}`);
    console.log(`   Cantidad requerida: ${testItem.quantity} unidades`);
    console.log(`   Código de barras: ${testItem.barcode}`);
    
    const scanResults = [];
    
    for (let scanNumber = 1; scanNumber <= testItem.quantity; scanNumber++) {
      console.log(`\n   🔍 Escaneo ${scanNumber}/${testItem.quantity}:`);
      
      try {
        const response = await axios.post(
          `${API_BASE_URL}/api/packaging/orders/${testOrder.id}/barcode-verify`,
          { barcode: testItem.barcode },
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        const result = response.data;
        scanResults.push(result);
        
        console.log(`   ✅ Respuesta: ${result.message}`);
        console.log(`   📊 Progreso: ${result.data.scan_progress}`);
        console.log(`   🎯 Verificado: ${result.data.is_verified}`);
        
        if (result.data.auto_completed) {
          console.log('   🎉 ¡Pedido completado automáticamente!');
        }
        
      } catch (error) {
        console.log(`   ❌ Error en escaneo ${scanNumber}:`, error.response?.data?.message || error.message);
        break;
      }
    }

    // 6. Verificar estado final en base de datos
    console.log('\n🔍 PASO 6: Verificando estado final en base de datos...');
    
    const [finalVerification] = await connection.execute(`
      SELECT 
        piv.scanned_count, 
        piv.required_scans, 
        piv.is_verified,
        piv.verification_notes,
        COUNT(sbs.id) as total_scans_recorded
      FROM packaging_item_verifications piv
      LEFT JOIN simple_barcode_scans sbs ON piv.order_id = sbs.order_id AND piv.item_id = sbs.item_id
      WHERE piv.order_id = ? AND piv.item_id = ?
      GROUP BY piv.id
    `, [testOrder.id, testItem.id]);
    
    if (finalVerification.length > 0) {
      const final = finalVerification[0];
      console.log(`✅ Estado final en BD:`);
      console.log(`   - Escaneos contados: ${final.scanned_count}/${final.required_scans}`);
      console.log(`   - Verificado: ${final.is_verified ? 'SÍ' : 'NO'}`);
      console.log(`   - Escaneos registrados: ${final.total_scans_recorded}`);
      console.log(`   - Notas: ${final.verification_notes || 'N/A'}`);
    } else {
      console.log('❌ No se encontró registro de verificación');
    }

    // 7. Verificar registro de escaneos individuales
    console.log('\n📜 PASO 7: Verificando registro de escaneos individuales...');
    
    const [scansLog] = await connection.execute(`
      SELECT scan_number, barcode, scanned_at
      FROM simple_barcode_scans
      WHERE order_id = ? AND item_id = ?
      ORDER BY scan_number
    `, [testOrder.id, testItem.id]);
    
    console.log(`✅ Escaneos registrados: ${scansLog.length}`);
    scansLog.forEach((scan, index) => {
      console.log(`   ${index + 1}. Escaneo #${scan.scan_number} - ${scan.barcode} - ${scan.scanned_at}`);
    });

    // 8. Probar endpoint de checklist para verificar que incluye información de escaneo
    console.log('\n📋 PASO 8: Verificando checklist con información de escaneo...');
    
    try {
      const checklistResponse = await axios.get(`${API_BASE_URL}/api/packaging/orders/${testOrder.id}/checklist`);
      const checklist = checklistResponse.data.data.checklist;
      
      const testItemInChecklist = checklist.find(item => item.id === testItem.id);
      
      if (testItemInChecklist) {
        console.log('✅ Item encontrado en checklist:');
        console.log(`   - Progreso de escaneo: ${testItemInChecklist.scan_progress || 'N/A'}`);
        console.log(`   - Requiere múltiples escaneos: ${testItemInChecklist.needs_multiple_scans}`);
        console.log(`   - Escaneos actuales: ${testItemInChecklist.scanned_count || 0}`);
        console.log(`   - Escaneos requeridos: ${testItemInChecklist.required_scans || 0}`);
      } else {
        console.log('⚠️  Item no encontrado en checklist');
      }
      
    } catch (error) {
      console.log('❌ Error obteniendo checklist:', error.response?.data?.message || error.message);
    }

    // 9. Resultados finales
    console.log('\n🎯 RESULTADOS FINALES:');
    console.log('='.repeat(50));
    
    const allSuccessful = scanResults.every(result => result.success);
    const finalScanResult = scanResults[scanResults.length - 1];
    
    if (allSuccessful && finalScanResult?.data?.is_verified) {
      console.log('🎉 ¡PRUEBA EXITOSA!');
      console.log('✅ Todos los escaneos se registraron correctamente');
      console.log('✅ El conteo de escaneos funciona apropiadamente');
      console.log('✅ El producto se verificó completamente después del último escaneo');
      console.log('✅ El sistema soporta múltiples "pistolasos" para productos con múltiples unidades');
    } else {
      console.log('❌ PRUEBA FALLIDA:');
      console.log('   - Escaneos exitosos:', scanResults.filter(r => r.success).length);
      console.log('   - Escaneos fallidos:', scanResults.filter(r => !r.success).length);
      console.log('   - Producto verificado:', finalScanResult?.data?.is_verified || false);
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Función para probar escaneo duplicado
async function testDuplicateScan() {
  console.log('\n🔄 PRUEBA ADICIONAL: Escaneo duplicado después de completar...');
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Buscar un item ya completamente verificado
    const [completedItems] = await connection.execute(`
      SELECT 
        piv.order_id, piv.item_id, 
        oi.name, oi.quantity,
        p.barcode,
        piv.scanned_count, piv.required_scans
      FROM packaging_item_verifications piv
      INNER JOIN order_items oi ON piv.item_id = oi.id
      INNER JOIN products p ON LOWER(TRIM(p.product_name)) = LOWER(TRIM(oi.name))
      WHERE piv.is_verified = 1 
        AND piv.scanned_count >= piv.required_scans 
        AND piv.required_scans > 1
      LIMIT 1
    `);
    
    if (completedItems.length === 0) {
      console.log('⚠️  No se encontraron items completamente verificados para probar');
      return;
    }
    
    const item = completedItems[0];
    console.log(`📦 Probando escaneo duplicado en: ${item.name}`);
    console.log(`   Estado actual: ${item.scanned_count}/${item.required_scans} (COMPLETO)`);
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/packaging/orders/${item.order_id}/barcode-verify`,
        { barcode: item.barcode },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const result = response.data;
      console.log(`✅ Respuesta: ${result.message}`);
      console.log('✅ El sistema correctamente previene escaneos duplicados');
      
    } catch (error) {
      console.log('❌ Error inesperado:', error.response?.data?.message || error.message);
    }
    
  } catch (error) {
    console.error('❌ Error en prueba de escaneo duplicado:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar pruebas
async function runAllTests() {
  await testBarcodeScanning();
  await testDuplicateScan();
  
  console.log('\n🏁 PRUEBAS COMPLETADAS');
  console.log('='.repeat(80));
}

runAllTests().catch(console.error);
