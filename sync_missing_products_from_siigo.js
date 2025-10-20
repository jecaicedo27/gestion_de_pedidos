const mysql = require('mysql2/promise');
const axios = require('axios');
const fs = require('fs');

async function syncMissingProductsFromSiigo() {
    console.log('=== SINCRONIZANDO PRODUCTOS FALTANTES DE SIIGO ===\n');
    
    // Configuración SIIGO
    const SIIGO_BASE_URL = 'https://api.siigo.com/v1';
    const USERNAME = 'sandbox_pruebas@niipgestion.com';
    const ACCESS_KEY = 'NDllMzI4YzItNDkwZi00YjZmLWE3ZWMtMjA5MWY4MzE5ODYx';
    
    let authToken = null;
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        // Obtener token de autenticación
        console.log('1. Obteniendo token de SIIGO...');
        const authResponse = await axios.post(`${SIIGO_BASE_URL}/auth`, {
            username: USERNAME,
            access_key: ACCESS_KEY
        });
        authToken = authResponse.data.access_token;
        console.log('✅ Token obtenido correctamente');

        // Intentar obtener todos los productos de SIIGO usando paginación manual
        let allProducts = [];
        let page = 1;
        const pageSize = 25; // Reducir el tamaño de página
        let hasMorePages = true;
        
        console.log('\n2. Obteniendo productos de SIIGO...');
        
        while (hasMorePages) {
            try {
                console.log(`   Página ${page}...`);
                
                const productsResponse = await axios.get(`${SIIGO_BASE_URL}/products`, {
                    headers: {
                        'Authorization': authToken,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'gestion_pedidos'
                    },
                    params: {
                        page: page,
                        page_size: pageSize
                    }
                });

                const products = productsResponse.data.results || productsResponse.data || [];
                
                if (products.length === 0) {
                    console.log(`   ⚠️  Página ${page} vacía, terminando...`);
                    hasMorePages = false;
                } else {
                    allProducts = allProducts.concat(products);
                    console.log(`   ✅ ${products.length} productos obtenidos (Total: ${allProducts.length})`);
                    
                    // Si obtuvimos menos productos que el tamaño de página, ya no hay más
                    if (products.length < pageSize) {
                        hasMorePages = false;
                    } else {
                        page++;
                        // Pausa entre requests para evitar rate limiting
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            } catch (pageError) {
                console.log(`   ❌ Error en página ${page}:`, pageError.response?.data || pageError.message);
                hasMorePages = false;
            }
        }

        console.log(`\n✅ Total productos obtenidos de SIIGO: ${allProducts.length}`);

        // Analizar productos por categorías
        const productsByCategory = {};
        allProducts.forEach(product => {
            const category = product.type || 'Sin categoría';
            if (!productsByCategory[category]) {
                productsByCategory[category] = [];
            }
            productsByCategory[category].push(product);
        });

        console.log('\n3. Productos por categoría en SIIGO:');
        Object.keys(productsByCategory).sort().forEach(category => {
            const count = productsByCategory[category].length;
            console.log(`   ${category}: ${count} productos`);
        });

        // Verificar qué categorías necesitan productos
        const [emptyCategories] = await connection.execute(`
            SELECT 
                c.name,
                c.id,
                COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name
            HAVING COUNT(p.id) = 0
            ORDER BY c.name ASC
        `);

        console.log('\n4. Categorías vacías en la base de datos:');
        emptyCategories.forEach(cat => {
            console.log(`   ${cat.name} (${cat.product_count} productos)`);
        });

        // Sincronizar productos faltantes
        let syncedProducts = 0;
        console.log('\n5. Sincronizando productos...');

        for (const product of allProducts) {
            try {
                const category = product.type || 'Sin categoría';
                
                // Verificar si el producto ya existe
                const [existingProduct] = await connection.execute(
                    'SELECT id FROM products WHERE code = ? OR siigo_id = ?',
                    [product.code, product.id]
                );

                if (existingProduct.length === 0) {
                    // Insertar producto nuevo
                    await connection.execute(`
                        INSERT INTO products (
                            name, code, siigo_id, category, price, cost, description,
                            is_active, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())
                    `, [
                        product.name || 'Producto sin nombre',
                        product.code || 'SIN_CODIGO',
                        product.id,
                        category,
                        product.prices?.[0]?.price_list?.[0]?.value || 0,
                        product.cost || 0,
                        product.description || ''
                    ]);
                    
                    syncedProducts++;
                    if (syncedProducts % 10 === 0) {
                        console.log(`   ✅ ${syncedProducts} productos sincronizados...`);
                    }
                }
            } catch (productError) {
                console.error(`   ❌ Error sincronizando producto ${product.code}:`, productError.message);
            }
        }

        console.log(`\n✅ Sincronización completada: ${syncedProducts} productos nuevos agregados`);

        // Verificar estado final
        console.log('\n6. Estado final de categorías:');
        const [finalCategories] = await connection.execute(`
            SELECT 
                c.name,
                COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name
            ORDER BY c.name ASC
        `);

        finalCategories.forEach(cat => {
            const status = cat.product_count > 0 ? '✅' : '⚠️ ';
            console.log(`   ${status} ${cat.name}: ${cat.product_count} productos`);
        });

    } catch (error) {
        console.error('❌ Error general:', error.response?.data || error.message);
    } finally {
        await connection.end();
    }
}

syncMissingProductsFromSiigo();
