const { pool } = require('./backend/config/database');
const siigoService = require('./backend/services/siigoService');

async function syncAllCategoriesFromSiigo() {
    try {
        console.log('🔍 Obteniendo TODAS las categorías desde SIIGO...');
        
        // 1. Obtener todos los productos con paginación manual para asegurar que obtenemos todo
        let allProducts = [];
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages) {
            console.log(`📦 Obteniendo página ${currentPage} de productos...`);
            
            // Usar el método interno del siigoService para obtener una página específica
            const headers = await siigoService.getHeaders();
            const axios = require('axios');
            
            const response = await axios.get(`${siigoService.getBaseUrl()}/v1/products`, {
                headers,
                params: {
                    page: currentPage,
                    page_size: 100
                },
                timeout: 30000
            });
            
            const pageProducts = response.data.results || [];
            const totalPages = response.data.pagination?.total_pages || 1;
            const totalResults = response.data.pagination?.total_results || 0;
            
            console.log(`✅ Página ${currentPage}/${totalPages}: ${pageProducts.length} productos obtenidos`);
            console.log(`📊 Total disponible: ${totalResults}`);
            
            allProducts = allProducts.concat(pageProducts);
            
            // Verificar si hay más páginas
            if (currentPage >= totalPages || pageProducts.length === 0) {
                hasMorePages = false;
            } else {
                currentPage++;
                // Pequeña pausa para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`📋 Total productos obtenidos de SIIGO: ${allProducts.length}`);
        const products = allProducts;
        
        // 2. Extraer todas las categorías únicas
        const categoryMap = new Map();
        
        products.forEach((product, index) => {
            if (product.account_group && product.account_group.name) {
                const categoryName = product.account_group.name;
                const categoryId = product.account_group.id;
                
                if (!categoryMap.has(categoryName)) {
                    categoryMap.set(categoryName, {
                        id: categoryId,
                        name: categoryName,
                        description: `Categoría extraída de productos SIIGO`,
                        active: true
                    });
                    console.log(`📂 Categoría encontrada: ${categoryName} (ID: ${categoryId})`);
                }
            } else {
                console.log(`⚠️ Producto sin categoría: ${product.name || 'Sin nombre'} (índice: ${index})`);
            }
        });
        
        const allCategories = Array.from(categoryMap.values());
        console.log(`\n📊 Total categorías únicas encontradas en SIIGO: ${allCategories.length}`);
        
        // 3. Mostrar todas las categorías encontradas
        console.log('\n=== TODAS LAS CATEGORÍAS EN SIIGO ===');
        allCategories.forEach(cat => {
            console.log(`- ${cat.name} (SIIGO_ID: ${cat.id})`);
        });
        
        // 4. Sincronizar con la base de datos
        console.log('\n🔄 Sincronizando categorías con la base de datos...');
        
        for (const siigoCategory of allCategories) {
            try {
                // Verificar si la categoría ya existe
                const [existing] = await pool.execute(
                    'SELECT id FROM categories WHERE siigo_id = ? OR name = ?',
                    [siigoCategory.id, siigoCategory.name]
                );
                
                if (existing.length > 0) {
                    // Actualizar categoría existente
                    await pool.execute(`
                        UPDATE categories 
                        SET name = ?, siigo_id = ?, description = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [
                        siigoCategory.name,
                        siigoCategory.id,
                        siigoCategory.description,
                        existing[0].id
                    ]);
                    console.log(`✅ Categoría actualizada: ${siigoCategory.name}`);
                } else {
                    // Insertar nueva categoría
                    await pool.execute(`
                        INSERT INTO categories (siigo_id, name, description, is_active, created_at, updated_at)
                        VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `, [
                        siigoCategory.id,
                        siigoCategory.name,
                        siigoCategory.description
                    ]);
                    console.log(`🆕 Nueva categoría creada: ${siigoCategory.name}`);
                }
            } catch (categoryError) {
                console.error(`❌ Error procesando categoría ${siigoCategory.name}:`, categoryError.message);
            }
        }
        
        // 5. Verificar resultado final
        const [finalCategories] = await pool.execute('SELECT COUNT(*) as total FROM categories WHERE is_active = TRUE');
        console.log(`\n✅ Sincronización completada. Total categorías activas en BD: ${finalCategories[0].total}`);
        
        // 6. Mostrar todas las categorías en la base de datos
        const [allDbCategories] = await pool.execute('SELECT name, siigo_id FROM categories WHERE is_active = TRUE ORDER BY name');
        console.log('\n=== CATEGORÍAS EN LA BASE DE DATOS DESPUÉS DE LA SINCRONIZACIÓN ===');
        allDbCategories.forEach(cat => {
            console.log(`- ${cat.name} (SIIGO_ID: ${cat.siigo_id})`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
        process.exit(1);
    }
}

syncAllCategoriesFromSiigo();
