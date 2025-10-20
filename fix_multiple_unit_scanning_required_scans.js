const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function fixMultipleUnitScanningRequiredScans() {
  let connection;
  
  try {
    console.log('🔧 CORRECCIÓN: Actualizando required_scans para items múltiples ya verificados');
    console.log('===============================================================================');
    
    connection = await mysql.createConnection(dbConfig);
    
    // 1. Identificar items con cantidad > 1 pero required_scans = 1
    console.log('\n📋 1. Identificando items con required_scans incorrectos...');
    const [problemItems] = await connection.execute(`
      SELECT 
        piv.id,
        piv.order_id,
        piv.item_id,
        oi.name,
        oi.quantity as required_quantity,
        piv.required_scans,
        piv.scanned_count,
        piv.is_verified
      FROM packaging_item_verifications piv
      JOIN order_items oi ON piv.item_id = oi.id
      WHERE oi.quantity > 1 
        AND piv.required_scans != oi.quantity
    `);
    
    console.log(`📊 Encontrados ${problemItems.length} items con required_scans incorrectos:`);
    
    if (problemItems.length > 0) {
      problemItems.forEach(item => {
        console.log(`  - ${item.name}: cantidad ${item.required_quantity}, pero required_scans ${item.required_scans} (debería ser ${item.required_quantity})`);
      });
      
      // 2. Corregir los required_scans
      console.log('\n🔧 2. Actualizando required_scans...');
      let updatedCount = 0;
      
      for (const item of problemItems) {
        try {
          await connection.execute(`
            UPDATE packaging_item_verifications 
            SET required_scans = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [item.required_quantity, item.id]);
          
          updatedCount++;
          console.log(`  ✅ ${item.name}: required_scans actualizado de ${item.required_scans} a ${item.required_quantity}`);
          
        } catch (error) {
          console.log(`  ❌ Error actualizando item ${item.id}: ${error.message}`);
        }
      }
      
      console.log(`\n📊 Total de items actualizados: ${updatedCount}`);
    } else {
      console.log('✅ No se encontraron items con required_scans incorrectos');
    }
    
    // 3. Resetear items ya verificados para permitir re-escaneo
    console.log('\n🔧 3. Reseteando items múltiples para re-escaneo...');
    const [resetResult] = await connection.execute(`
      UPDATE packaging_item_verifications piv
      JOIN order_items oi ON piv.item_id = oi.id
      SET 
        piv.scanned_count = 0,
        piv.is_verified = FALSE,
        piv.verification_notes = CONCAT(COALESCE(piv.verification_notes, ''), ' | Reseteado para escaneo múltiple - ', NOW()),
        piv.updated_at = CURRENT_TIMESTAMP
      WHERE oi.quantity > 1 
        AND piv.is_verified = TRUE
        AND piv.scanned_count = 0
    `);
    
    console.log(`📊 Items reseteados para re-escaneo: ${resetResult.affectedRows}`);
    
    // 4. Mostrar estado final
    console.log('\n📋 4. Estado final de items múltiples...');
    const [finalState] = await connection.execute(`
      SELECT 
        o.order_number,
        oi.name,
        oi.quantity as required_quantity,
        piv.required_scans,
        piv.scanned_count,
        piv.is_verified,
        CASE 
          WHEN piv.is_verified = TRUE AND piv.scanned_count >= piv.required_scans THEN '✅ Completo'
          WHEN piv.scanned_count > 0 AND piv.scanned_count < piv.required_scans THEN '📊 En progreso'
          WHEN piv.scanned_count = 0 THEN '⏳ Pendiente'
          ELSE '❓ Estado incierto'
        END as estado
      FROM packaging_item_verifications piv
      JOIN order_items oi ON piv.item_id = oi.id
      JOIN orders o ON piv.order_id = o.id
      WHERE oi.quantity > 1
      ORDER BY o.order_number, oi.name
      LIMIT 15
    `);
    
    console.log('🔍 Estado de items múltiples (primeros 15):');
    finalState.forEach(item => {
      console.log(`  ${item.estado} ${item.order_number} - ${item.name}: ${item.scanned_count}/${item.required_scans} escaneos`);
    });
    
    // 5. Verificar productos con códigos de barras para testing
    console.log('\n📋 5. Productos disponibles para testing...');
    const [testableProducts] = await connection.execute(`
      SELECT DISTINCT
        p.product_name,
        p.barcode,
        p.internal_code,
        oi.quantity,
        o.order_number,
        piv.scanned_count,
        piv.required_scans
      FROM products p
      JOIN order_items oi ON LOWER(TRIM(p.product_name)) = LOWER(TRIM(oi.name))
      JOIN orders o ON oi.order_id = o.id
      JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND o.id = piv.order_id
      WHERE (p.barcode IS NOT NULL AND p.barcode != '')
        AND o.status IN ('en_empaque', 'en_preparacion')
        AND oi.quantity > 1
        AND piv.scanned_count = 0
      ORDER BY oi.quantity DESC, o.order_number
      LIMIT 5
    `);
    
    if (testableProducts.length > 0) {
      console.log('🧪 Productos listos para testing de escaneo múltiple:');
      testableProducts.forEach(product => {
        console.log(`  📦 ${product.order_number} - ${product.product_name} (${product.quantity} unid)`);
        console.log(`     📊 Código: ${product.barcode} | Progreso: ${product.scanned_count}/${product.required_scans}`);
      });
    } else {
      console.log('⚠️ No hay productos con códigos de barras disponibles para testing inmediato');
    }
    
    console.log('\n✅ CORRECCIÓN COMPLETADA');
    console.log('========================');
    console.log('🔧 Cambios aplicados:');
    console.log(`  ✓ ${updatedCount} items con required_scans corregidos`);
    console.log(`  ✓ ${resetResult.affectedRows} items reseteados para re-escaneo`);
    console.log('  ✓ Sistema listo para testing de escaneo múltiple');
    
    console.log('\n📋 Para probar:');
    console.log('  1. Ve a la página de Empaque');
    console.log('  2. Inicia empaque de uno de los pedidos mostrados');
    console.log('  3. Cambia a modo "Código de Barras"');
    console.log('  4. Escanea el código de barras de un producto de múltiples unidades');
    console.log('  5. Verifica que muestre: "1/X unidades escaneadas"');
    console.log('  6. Continúa escaneando hasta completar todas las unidades');
    
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
fixMultipleUnitScanningRequiredScans().catch(console.error);
