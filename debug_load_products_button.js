const siigoService = require('./backend/services/siigoService');
const { pool } = require('./backend/config/database');

async function debugLoadProductsButton() {
    console.log('🔍 Debuggeando función "Cargar Productos" del botón...');
    
    try {
        console.log('📦 Obteniendo productos de SIIGO...');
        const siigoProducts = await siigoService.getAllProducts();
        
        if (!siigoProducts || siigoProducts.length === 0) {
            console.log('❌ No se encontraron productos en SIIGO');
            return;
        }
        
        console.log(`📊 Se encontraron ${siigoProducts.length} productos en SIIGO`);
        
        // Probar con los primeros 3 productos
        const testProducts = siigoProducts.slice(0, 3);
        
        for (const product of testProducts) {
            console.log('\n==========================================');
            console.log(`📦 Producto: ${product.name}`);
            console.log(`🆔 ID SIIGO: ${product.id}`);
            console.log(`🔤 Código: ${product.code}`);
            
            // Verificar categoría actual
            console.log(`📂 Categoría RAW: ${JSON.stringify(product.account_group)}`);
            const category = product.account_group?.name || 'Sin categoría';
            console.log(`📂 Categoría extraída: "${category}"`);
            
            // Verificar precio actual  
            console.log(`💰 Precios RAW: ${JSON.stringify(product.prices)}`);
            const price = extractPriceFromSiigo(product);
            console.log(`💰 Precio extraído: $${price}`);
            
            // Verificar estado
            console.log(`✅ Estado: ${product.active}`);
            
            // Ver qué hay en la BD actualmente
            const [existing] = await pool.execute(
                'SELECT id, product_name, category, standard_price, is_active FROM products WHERE siigo_product_id = ?',
                [product.id]
            );
            
            if (existing.length > 0) {
                console.log(`🗄️ En BD actualmente:`);
                console.log(`   - Nombre: "${existing[0].product_name}"`);
                console.log(`   - Categoría: "${existing[0].category}"`);
                console.log(`   - Precio: $${existing[0].standard_price}`);
                console.log(`   - Activo: ${existing[0].is_active}`);
            } else {
                console.log(`🗄️ Producto NO encontrado en BD`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

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

debugLoadProductsButton();
