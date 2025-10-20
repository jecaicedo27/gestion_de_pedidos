const mysql = require('mysql2/promise');

console.log('🔍 Checking and fixing categories table...\n');

async function checkAndFixCategoriesTable() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        console.log('✅ Connected to database');
        
        // Check if categories table exists
        const [tables] = await connection.execute(`
            SHOW TABLES LIKE 'categories'
        `);
        
        if (tables.length === 0) {
            console.log('❌ Categories table does not exist, creating it...');
            
            // Create categories table
            await connection.execute(`
                CREATE TABLE categories (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    is_active TINYINT(1) DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            
            console.log('✅ Categories table created');
        } else {
            console.log('✅ Categories table exists');
        }
        
        // Check current categories
        const [currentCategories] = await connection.execute(`
            SELECT * FROM categories ORDER BY name ASC
        `);
        
        console.log(`\n📊 Current categories in table: ${currentCategories.length}`);
        currentCategories.forEach((cat, index) => {
            console.log(`   ${index + 1}. ${cat.name} (active: ${cat.is_active})`);
        });
        
        // Define the required categories for the inventory system
        const requiredCategories = [
            'GENIALITY',
            'LIQUIPOPS',
            'MEZCLAS EN POLVO',
            'Productos No fabricados 19%',
            'YEXIS',
            'SKARCHA NO FABRICADOS 19%'
        ];
        
        console.log('\n🔧 Ensuring required categories exist...');
        
        for (const categoryName of requiredCategories) {
            const [existing] = await connection.execute(`
                SELECT id FROM categories WHERE name = ?
            `, [categoryName]);
            
            if (existing.length === 0) {
                await connection.execute(`
                    INSERT INTO categories (name, is_active) VALUES (?, 1)
                `, [categoryName]);
                console.log(`   ✅ Added: ${categoryName}`);
            } else {
                console.log(`   ✓ Exists: ${categoryName}`);
            }
        }
        
        // Final check
        const [finalCategories] = await connection.execute(`
            SELECT name FROM categories WHERE is_active = 1 ORDER BY name ASC
        `);
        
        console.log(`\n✅ Final categories count: ${finalCategories.length}`);
        console.log('📋 Active categories:');
        finalCategories.forEach((cat, index) => {
            console.log(`   ${index + 1}. ${cat.name}`);
        });
        
        // Test the API response structure
        const categories = finalCategories.map(row => row.name);
        console.log('\n🧪 Testing API response format:');
        console.log(JSON.stringify(categories, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code) {
            console.error('   Error Code:', error.code);
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

checkAndFixCategoriesTable();
