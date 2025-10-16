const mysql = require('mysql2/promise');

async function checkCategories() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        // Check current categories in our database
        const [localCategories] = await connection.execute(`
            SELECT name, COUNT(*) as count
            FROM categories 
            WHERE is_active = TRUE
            GROUP BY name
            ORDER BY name ASC
        `);

        console.log('=== CATEGORIES IN LOCAL DATABASE ===');
        localCategories.forEach(cat => {
            console.log(`${cat.name} (${cat.count})`);
        });
        console.log(`Total categories in database: ${localCategories.length}`);

        // Also check products to see what categories they reference
        const [productCategories] = await connection.execute(`
            SELECT category, COUNT(*) as product_count
            FROM products 
            WHERE is_active = TRUE AND category IS NOT NULL AND category != ''
            GROUP BY category
            ORDER BY category ASC
        `);

        console.log('\n=== CATEGORIES REFERENCED BY PRODUCTS ===');
        productCategories.forEach(cat => {
            console.log(`${cat.category} (${cat.product_count} products)`);
        });
        console.log(`Total unique categories from products: ${productCategories.length}`);

        // Find categories that exist in products but not in categories table
        const categoryNames = new Set(localCategories.map(c => c.name));
        const missingCategories = productCategories.filter(pc => !categoryNames.has(pc.category));
        
        if (missingCategories.length > 0) {
            console.log('\n=== CATEGORIES MISSING FROM CATEGORIES TABLE ===');
            missingCategories.forEach(cat => {
                console.log(`${cat.category} (${cat.product_count} products)`);
            });
        }

        // Check SIIGO sync status
        const [syncStatus] = await connection.execute(`
            SELECT siigo_id, name
            FROM categories
            WHERE siigo_id IS NOT NULL
            ORDER BY name ASC
        `);

        console.log('\n=== CATEGORIES WITH SIIGO IDs ===');
        syncStatus.forEach(cat => {
            console.log(`${cat.name} (SIIGO ID: ${cat.siigo_id})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkCategories();
