const mysql = require('mysql2/promise');

async function checkCurrentProductsStatus() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('=== ESTADO ACTUAL DE PRODUCTOS Y CATEGORÍAS ===\n');

        // 1. Verificar total de productos
        const [productCount] = await connection.execute(
            'SELECT COUNT(*) as total FROM products WHERE is_active = TRUE'
        );
        console.log(`Total productos activos: ${productCount[0].total}`);

        // 2. Productos por categoría
        const [productsByCategory] = await connection.execute(`
            SELECT 
                category,
                COUNT(*) as product_count
            FROM products 
            WHERE is_active = TRUE AND category IS NOT NULL AND category != ''
            GROUP BY category
            ORDER BY product_count DESC
        `);

        console.log('\n=== PRODUCTOS POR CATEGORÍA (EXISTENTES) ===');
        productsByCategory.forEach(cat => {
            console.log(`${cat.category}: ${cat.product_count} productos`);
        });

        // 3. Categorías vacías
        const [emptyCategories] = await connection.execute(`
            SELECT 
                c.name as category_name
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name
            HAVING COUNT(p.id) = 0
            ORDER BY c.name ASC
        `);

        console.log('\n=== CATEGORÍAS SIN PRODUCTOS ===');
        emptyCategories.forEach(cat => {
            console.log(`❌ ${cat.category_name}: 0 productos`);
        });

        // 4. Productos sin categoría
        const [uncategorizedProducts] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM products 
            WHERE is_active = TRUE AND (category IS NULL OR category = '' OR category = 'Sin categoría')
        `);

        console.log(`\n=== PRODUCTOS SIN CATEGORÍA ===`);
        console.log(`Productos sin categoría: ${uncategorizedProducts[0].count}`);

        // 5. Productos con SIIGO ID
        const [productsWithSiigoId] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM products 
            WHERE is_active = TRUE AND siigo_id IS NOT NULL
        `);

        console.log(`\n=== SINCRONIZACIÓN CON SIIGO ===`);
        console.log(`Productos con SIIGO ID: ${productsWithSiigoId[0].count}`);

        // 6. Mostrar algunos productos recientes para debug
        const [recentProducts] = await connection.execute(`
            SELECT name, code, category, siigo_id
            FROM products 
            WHERE is_active = TRUE 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        console.log(`\n=== PRODUCTOS RECIENTES (ÚLTIMOS 5) ===`);
        recentProducts.forEach(prod => {
            const siigoInfo = prod.siigo_id ? ` (SIIGO: ${prod.siigo_id})` : ' (Sin SIIGO)';
            console.log(`${prod.name} [${prod.code}] - ${prod.category || 'Sin categoría'}${siigoInfo}`);
        });

        console.log('\n=== RECOMENDACIÓN ===');
        console.log('🔄 Para completar la sincronización de productos:');
        console.log('1. Ve a la página de productos en tu aplicación');
        console.log('2. Haz clic en el botón "Cargar Productos"');
        console.log('3. Esto sincronizará automáticamente todos los productos de SIIGO');
        console.log('4. Las categorías vacías se llenarán con sus productos correspondientes');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkCurrentProductsStatus();
