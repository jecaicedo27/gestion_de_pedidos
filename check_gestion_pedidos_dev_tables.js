const mysql = require('mysql2/promise');

async function checkTables() {
    console.log('🔍 Checking tables in gestion_pedidos_dev...\n');
    
    try {
        // Connect to the correct database
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'  // Using the correct database name
        });
        
        // List all tables
        const [tables] = await connection.execute('SHOW TABLES');
        console.log(`📊 Found ${tables.length} tables:`);
        
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`  - ${tableName}`);
        });
        
        // Check for products_batch table
        const hasProductsBatch = tables.some(table => Object.values(table)[0] === 'products_batch');
        
        if (hasProductsBatch) {
            console.log('\n✅ products_batch table exists!');
            
            // Count products
            const [count] = await connection.execute('SELECT COUNT(*) as total FROM products_batch');
            console.log(`📦 Total products: ${count[0].total}`);
            
            // Count active products
            const [activeCount] = await connection.execute('SELECT COUNT(*) as total FROM products_batch WHERE is_active = 1');
            console.log(`✅ Active products: ${activeCount[0].total}`);
            
            // Get categories
            const [categories] = await connection.execute(`
                SELECT DISTINCT category, COUNT(*) as count 
                FROM products_batch 
                WHERE is_active = 1 AND category IS NOT NULL 
                GROUP BY category 
                ORDER BY count DESC
                LIMIT 10
            `);
            
            if (categories.length > 0) {
                console.log('\n📂 Categories found:');
                categories.forEach(cat => {
                    console.log(`  - ${cat.category}: ${cat.count} products`);
                });
            }
        } else {
            console.log('\n❌ products_batch table does not exist');
        }
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
    }
}

checkTables();
