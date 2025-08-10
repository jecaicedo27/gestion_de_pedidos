const siigoService = require('./backend/services/siigoService');
const { pool } = require('./backend/config/database');

async function fixProductCategoriesImmediate() {
  console.log('🔧 Iniciando corrección inmediata de categorías de productos...');
  
  try {
    // Obtener productos de SIIGO con estructura correcta
    const siigoProducts = await siigoService.getAllProducts();
    console.log(`📦 Se obtuvieron ${siigoProducts.length} productos de SIIGO`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const product of siigoProducts) {
      try {
        // Extraer datos correctos de SIIGO
        const category = product.account_group?.name || 'Sin categoría';
        const price = extractPriceFromSiigo(product);
        const isActive = product.active !== false;
        
        console.log(`🔄 Actualizando producto: ${product.name}`);
        console.log(`   - Categoría: ${category}`);
        console.log(`   - Precio: ${price}`);
        console.log(`   - Activo: ${isActive}`);
        
        // Actualizar en base de datos
        const [result] = await pool.execute(`
          UPDATE products 
          SET category = ?, 
              standard_price = ?,
              is_active = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE siigo_product_id = ?
        `, [category, price, isActive, product.id]);
        
        if (result.affectedRows > 0) {
          updatedCount++;
          console.log(`   ✅ Actualizado`);
        } else {
          console.log(`   ⚠️ No se encontró producto con siigo_product_id: ${product.id}`);
        }
        
      } catch (productError) {
        console.error(`   ❌ Error actualizando producto ${product.name}:`, productError.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Corrección completada:`);
    console.log(`   ✅ ${updatedCount} productos actualizados`);
    console.log(`   ❌ ${errorCount} errores`);
    
  } catch (error) {
    console.error('❌ Error en corrección de categorías:', error);
  } finally {
    process.exit(0);
  }
}

// Función auxiliar para extraer precio
function extractPriceFromSiigo(product) {
  try {
    if (product.prices && 
        Array.isArray(product.prices) && 
        product.prices.length > 0 &&
        product.prices[0].price_list &&
        Array.isArray(product.prices[0].price_list) &&
        product.prices[0].price_list.length > 0) {
      
      return parseFloat(product.prices[0].price_list[0].value) || 0;
    }
    return 0;
  } catch (error) {
    console.warn('Error extrayendo precio:', error.message);
    return 0;
  }
}

fixProductCategoriesImmediate();
