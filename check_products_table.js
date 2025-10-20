const mysql = require('mysql2/promise');

async function checkProductsTable() {
    console.log('🔍 Checking products table in gestion_pedidos_dev...\n');
    
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        // Check products table structure
        const [columns] = await connection.execute('SHOW COLUMNS FROM products');
        console.log('📊 Products table structure:');
        columns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });
        
        // Count total products
        const [totalCount] = await connection.execute('SELECT COUNT(*) as total FROM products');
        console.log(`\n📦 Total products: ${totalCount[0].total}`);
        
        // Count active products (checking different possible column names)
        try {
            const [activeCount] = await connection.execute('SELECT COUNT(*) as total FROM products WHERE is_active = 1');
            console.log(`✅ Active products: ${activeCount[0].total}`);
        } catch (e) {
            try {
                const [activeCount] = await connection.execute('SELECT COUNT(*) as total FROM products WHERE active = 1');
                console.log(`✅ Active products: ${activeCount[0].total}`);
            } catch (e2) {
                console.log('⚠️ No active/is_active column found');
            }
        }
        
        // Get distinct categories
        const [categories] = await connection.execute(`
            SELECT DISTINCT category, COUNT(*) as count 
            FROM products 
            WHERE category IS NOT NULL AND category != ''
            GROUP BY category 
            ORDER BY count DESC
        `);
        
        console.log(`\n📂 Categories found: ${categories.length}`);
        if (categories.length > 0) {
            console.log('Categories with product counts:');
            categories.forEach(cat => {
                console.log(`  - ${cat.category}: ${cat.count} products`);
            });
        }
        
        // Get sample products
        const [sampleProducts] = await connection.execute(`
            SELECT * FROM products LIMIT 3
        `);
        
        console.log('\n📦 Sample products:');
        sampleProducts.forEach(product => {
            console.log(`  - [${product.product_code || product.code}] ${product.name}`);
            console.log(`    Category: ${product.category || 'N/A'}, Price: $${product.price || 0}`);
        });
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
    }
}

checkProductsTable();
