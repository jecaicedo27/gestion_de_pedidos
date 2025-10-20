const mysql = require('mysql2');
const axios = require('axios');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'gestion_pedidos_dev'
});

async function debugPackagingVerification() {
  console.log('🔍 DIAGNÓSTICO DEL SISTEMA DE VERIFICACIÓN DE EMPAQUE');
  console.log('=====================================================\n');

  try {
    // 1. Verificar estado del backend
    console.log('1. 🌐 Verificando estado del backend...');
    try {
      const response = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
      console.log('✅ Backend activo:', response.status);
    } catch (error) {
      console.log('❌ Backend no responde:', error.message);
      return;
    }

    // 2. Verificar estructura de tablas necesarias
    console.log('\n2. 📊 Verificando estructura de base de datos...');
    
    const tables = ['orders', 'order_items', 'packaging_item_verifications', 'products', 'barcode_scans'];
    
    for (const table of tables) {
      try {
        const [rows] = await connection.promise().query(`DESCRIBE ${table}`);
        console.log(`✅ Tabla ${table}: ${rows.length} columnas`);
      } catch (error) {
        console.log(`❌ Tabla ${table}: NO EXISTE - ${error.message}`);
      }
    }

    // 3. Verificar pedidos en proceso de empaque
    console.log('\n3. 📦 Verificando pedidos en proceso de empaque...');
    const [packagingOrders] = await connection.promise().query(`
      SELECT 
        id,
        order_number,
        customer_name,
        status,
        created_at
      FROM orders 
      WHERE status IN ('en_empaque', 'en_preparacion') 
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (packagingOrders.length === 0) {
      console.log('⚠️  No hay pedidos en proceso de empaque');
    } else {
      console.log(`✅ ${packagingOrders.length} pedidos en proceso:`);
      packagingOrders.forEach(order => {
        console.log(`   - Pedido ${order.order_number}: ${order.status} (${order.customer_name})`);
      });
    }

    // 4. Verificar items con verificación parcial
    console.log('\n4. 🔍 Verificando items con verificación parcial...');
    const [partialVerifications] = await connection.promise().query(`
      SELECT 
        o.order_number,
        oi.name as item_name,
        oi.quantity as required_quantity,
        piv.packed_quantity,
        piv.is_verified,
        piv.verification_notes,
        piv.scanned_count,
        piv.required_scans
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id
      WHERE o.status IN ('en_empaque', 'en_preparacion')
        AND piv.id IS NOT NULL
      ORDER BY o.id, oi.id
      LIMIT 10
    `);

    if (partialVerifications.length === 0) {
      console.log('⚠️  No hay items con verificaciones parciales');
    } else {
      console.log(`✅ ${partialVerifications.length} items con verificaciones:`);
      partialVerifications.forEach(item => {
        const status = item.is_verified ? '✅ Completado' : '🔄 En progreso';
        const scanInfo = item.scanned_count ? `(${item.scanned_count}/${item.required_scans} escaneos)` : '';
        console.log(`   - ${item.item_name}: ${item.packed_quantity}/${item.required_quantity} ${status} ${scanInfo}`);
      });
    }

    // 5. Verificar tabla de escaneos de códigos de barras
    console.log('\n5. 📱 Verificando escaneos de códigos de barras...');
    try {
      const [barcodeScans] = await connection.promise().query(`
        SELECT 
          bs.order_id,
          bs.product_code,
          bs.barcode,
          COUNT(*) as scan_count,
          MAX(bs.scanned_at) as last_scan
        FROM barcode_scans bs
        GROUP BY bs.order_id, bs.product_code, bs.barcode
        ORDER BY last_scan DESC
        LIMIT 10
      `);
      
      if (barcodeScans.length === 0) {
        console.log('⚠️  No hay registros de escaneos de códigos de barras');
      } else {
        console.log(`✅ ${barcodeScans.length} registros de escaneos:`);
        barcodeScans.forEach(scan => {
          console.log(`   - Orden ${scan.order_id}: ${scan.product_code || scan.barcode} (${scan.scan_count} escaneos)`);
        });
      }
    } catch (error) {
      console.log('❌ Error consultando tabla barcode_scans:', error.message);
    }

    // 6. Probar endpoint de verificación
    console.log('\n6. 🧪 Probando endpoints de empaque...');
    try {
      const response = await axios.get('http://localhost:3001/api/packaging/stats');
      console.log('✅ Endpoint de estadísticas:', response.status);
      console.log('   Datos:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Error en endpoint de estadísticas:', error.message);
    }

    // 7. Verificar productos con códigos de barras
    console.log('\n7. 🏷️  Verificando productos con códigos de barras...');
    const [productsWithBarcodes] = await connection.promise().query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN barcode IS NOT NULL AND barcode != '' THEN 1 END) as with_barcode,
        COUNT(CASE WHEN internal_code IS NOT NULL AND internal_code != '' THEN 1 END) as with_internal_code
      FROM products
    `);

    const stats = productsWithBarcodes[0];
    console.log(`✅ Productos: ${stats.total_products} total, ${stats.with_barcode} con código de barras, ${stats.with_internal_code} con código interno`);

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
  } finally {
    connection.end();
  }

  console.log('\n📋 RESUMEN DEL DIAGNÓSTICO:');
  console.log('1. Si el backend no responde → Reiniciar servidor backend');
  console.log('2. Si faltan tablas → Ejecutar migraciones de BD');
  console.log('3. Si no hay pedidos en empaque → Crear pedidos de prueba');
  console.log('4. Si faltan códigos de barras → Sincronizar productos con SIIGO');
  console.log('5. Si hay errores en endpoints → Revisar logs del servidor');
}

debugPackagingVerification();
