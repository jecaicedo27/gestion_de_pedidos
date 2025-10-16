const axios = require('axios');
const { query } = require('./backend/config/database');

async function syncInventoryFromSiigo() {
  console.log('🔄 Iniciando sincronización de inventario desde SIIGO...');
  
  try {
    // 1. Obtener token de SIIGO
    const authResponse = await axios.post('https://api.siigo.com/auth', {
      username: process.env.SIIGO_USERNAME,
      access_key: process.env.SIIGO_ACCESS_KEY
    });

    const token = authResponse.data.access_token;
    console.log('✅ Token de SIIGO obtenido');

    // 2. Obtener todos los productos de SIIGO
    let page = 1;
    let hasMorePages = true;
    let totalProductsUpdated = 0;

    while (hasMorePages) {
      console.log(`📄 Obteniendo página ${page} de productos...`);
      
      const productsResponse = await axios.get(`https://api.siigo.com/v1/products?page=${page}&page_size=100`, {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });

      const products = productsResponse.data.results || [];
      
      if (products.length === 0) {
        hasMorePages = false;
        break;
      }

      // 3. Actualizar cada producto en la base de datos local
      for (const siigoProduct of products) {
        try {
          // Buscar el producto en la BD local por código o nombre
          const localProduct = await query(`
            SELECT id, code, product_name 
            FROM products 
            WHERE code = ? OR siigo_code = ? OR product_name LIKE ?
            LIMIT 1
          `, [
            siigoProduct.code,
            siigoProduct.code,
            `%${siigoProduct.name}%`
          ]);

          if (localProduct.length > 0) {
            // Actualizar stock del producto local
            await query(`
              UPDATE products 
              SET 
                available_quantity = ?,
                stock = ?,
                standard_price = ?,
                siigo_code = ?,
                updated_at = NOW()
              WHERE id = ?
            `, [
              siigoProduct.available_quantity || 0,
              siigoProduct.available_quantity || 0,
              siigoProduct.price || siigoProduct.unit_price || 0,
              siigoProduct.code,
              localProduct[0].id
            ]);

            console.log(`✅ Actualizado: ${siigoProduct.name} - Stock: ${siigoProduct.available_quantity || 0}`);
            totalProductsUpdated++;
          } else {
            // Crear producto si no existe localmente
            try {
              await query(`
                INSERT INTO products (
                  code, siigo_code, product_name, category, 
                  available_quantity, stock, standard_price,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
              `, [
                siigoProduct.code,
                siigoProduct.code,
                siigoProduct.name,
                siigoProduct.category || 'GENERAL',
                siigoProduct.available_quantity || 0,
                siigoProduct.available_quantity || 0,
                siigoProduct.price || siigoProduct.unit_price || 0
              ]);

              console.log(`➕ Creado producto nuevo: ${siigoProduct.name} - Stock: ${siigoProduct.available_quantity || 0}`);
              totalProductsUpdated++;
            } catch (insertError) {
              console.log(`⚠️ No se pudo crear producto ${siigoProduct.name}:`, insertError.message);
            }
          }
        } catch (productError) {
          console.log(`⚠️ Error procesando producto ${siigoProduct.name}:`, productError.message);
        }
      }

      page++;
      
      // Verificar si hay más páginas
      hasMorePages = productsResponse.data.pagination?.next_page_url ? true : false;
    }

    console.log(`🎉 Sincronización completada: ${totalProductsUpdated} productos actualizados`);
    
    // 4. Mostrar resumen del inventario actualizado
    const inventorySummary = await query(`
      SELECT 
        category,
        COUNT(*) as total_products,
        SUM(available_quantity) as total_stock,
        AVG(available_quantity) as avg_stock
      FROM products 
      WHERE available_quantity > 0
      GROUP BY category
      ORDER BY total_stock DESC
    `);

    console.log('\n📊 RESUMEN DE INVENTARIO ACTUALIZADO:');
    inventorySummary.forEach(cat => {
      console.log(`  ${cat.category}: ${cat.total_products} productos, Stock total: ${cat.total_stock}, Promedio: ${Math.round(cat.avg_stock)}`);
    });

    return {
      success: true,
      totalUpdated: totalProductsUpdated,
      summary: inventorySummary
    };

  } catch (error) {
    console.error('❌ Error sincronizando inventario:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  syncInventoryFromSiigo().then(result => {
    if (result.success) {
      console.log(`\n✅ Sincronización exitosa: ${result.totalUpdated} productos actualizados`);
      console.log('🔄 Actualiza la página del inventario para ver los cambios');
    } else {
      console.log('\n❌ Sincronización falló:', result.error);
    }
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { syncInventoryFromSiigo };
