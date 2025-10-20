const mysql = require('mysql2/promise');

async function checkProductsInDatabase() {
    console.log('🔍 Checking products directly in database...\n');
    
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos'
        });
        
        // 1. Check if products_batch table exists
        const [tables] = await connection.execute(`
            SHOW TABLES LIKE 'products_batch'
        `);
        
        if (tables.length === 0) {
            console.log('❌ Table products_batch does not exist!');
            await connection.end();
            return;
        }
        
        console.log('✅ Table products_batch exists');
        
        // 2. Count total products
        const [totalCount] = await connection.execute(`
            SELECT COUNT(*) as total FROM products_batch
        `);
        console.log(`\n📊 Total products in database: ${totalCount[0].total}`);
        
        // 3. Count active products
        const [activeCount] = await connection.execute(`
            SELECT COUNT(*) as total FROM products_batch WHERE is_active = 1
        `);
        console.log(`✅ Active products: ${activeCount[0].total}`);
        
        // 4. Get categories with product counts
        const [categories] = await connection.execute(`
            SELECT category, COUNT(*) as count 
            FROM products_batch 
            WHERE is_active = 1 AND category IS NOT NULL 
            GROUP BY category 
            ORDER BY count DESC
        `);
        
        if (categories.length > 0) {
            console.log('\n📂 Categories with product counts:');
            categories.forEach(cat => {
                console.log(`  - ${cat.category}: ${cat.count} products`);
            });
        } else {
            console.log('⚠️ No categories found or all products have NULL category');
        }
        
        // 5. Get sample products
        const [sampleProducts] = await connection.execute(`
            SELECT id, product_code, name, category, price, stock, is_active 
            FROM products_batch 
            WHERE is_active = 1 
            LIMIT 5
        `);
        
        if (sampleProducts.length > 0) {
            console.log('\n📦 Sample products:');
            sampleProducts.forEach(product => {
                console.log(`  - [${product.product_code}] ${product.name}`);
                console.log(`    Category: ${product.category || 'N/A'}, Price: $${product.price}, Stock: ${product.stock}`);
            });
        }
        
        // 6. Check if we have the requested categories
        const requestedCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS'];
        console.log('\n🔍 Checking requested categories:');
        
        for (const cat of requestedCategories) {
            const [catCount] = await connection.execute(`
                SELECT COUNT(*) as count FROM products_batch 
                WHERE category = ? AND is_active = 1
            `, [cat]);
            
            if (catCount[0].count > 0) {
                console.log(`  ✅ ${cat}: ${catCount[0].count} products`);
            } else {
                console.log(`  ❌ ${cat}: NOT FOUND`);
            }
        }
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
    }
}

checkProductsInDatabase();
