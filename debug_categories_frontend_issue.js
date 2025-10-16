const mysql = require('mysql2/promise');
const axios = require('axios');
const path = require('path');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function debugCategoriesIssue() {
    console.log('🔍 DEBUGGING CATEGORIES FRONTEND ISSUE');
    console.log('=' .repeat(60));
    
    let connection;
    
    try {
        // 1. Check Database Categories
        console.log('\n📊 1. Checking Categories in Database...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos',
            port: process.env.DB_PORT || 3306
        });
        
        // Check if categories table exists
        const [tables] = await connection.execute("SHOW TABLES LIKE 'categories'");
        if (tables.length === 0) {
            console.log('❌ Categories table does not exist!');
            console.log('   Need to create categories table first');
            return;
        }
        console.log('✅ Categories table exists');
        
        // Count categories
        const [categoryCount] = await connection.execute('SELECT COUNT(*) as count FROM categories');
        console.log(`   Categories in database: ${categoryCount[0].count}`);
        
        if (categoryCount[0].count === 0) {
            console.log('❌ No categories found in database');
            console.log('   Need to populate categories from SIIGO');
            
            // Try to get some sample categories from products
            const [productCategories] = await connection.execute(`
                SELECT DISTINCT category, COUNT(*) as product_count 
                FROM products 
                WHERE category IS NOT NULL AND category != '' 
                GROUP BY category 
                ORDER BY product_count DESC
                LIMIT 10
            `);
            
            if (productCategories.length > 0) {
                console.log('   📦 Categories found in products table:');
                productCategories.forEach(cat => {
                    console.log(`      - ${cat.category}: ${cat.product_count} products`);
                });
            }
            return;
        }
        
        // Show sample categories
        const [sampleCategories] = await connection.execute(`
            SELECT id, name, siigo_id 
            FROM categories 
            ORDER BY name 
            LIMIT 10
        `);
        
        console.log('   📋 Sample categories:');
        sampleCategories.forEach(cat => {
            console.log(`      - ID: ${cat.id}, Name: ${cat.name}, SIIGO ID: ${cat.siigo_id}`);
        });
        
        // 2. Test Categories API Endpoint
        console.log('\n🌐 2. Testing Categories API Endpoint...');
        
        try {
            // Test without authentication first
            const response = await axios.get('http://localhost:3000/api/categories');
            
            console.log(`   Status: ${response.status}`);
            console.log(`   Categories returned: ${response.data.length}`);
            
            if (response.data.length > 0) {
                console.log('   📋 Sample API response:');
                response.data.slice(0, 5).forEach(cat => {
                    console.log(`      - ${cat.id}: ${cat.name}`);
                });
                console.log('✅ Categories API is working correctly');
            } else {
                console.log('❌ API returned empty categories array');
            }
            
        } catch (apiError) {
            console.log(`❌ API Error: ${apiError.message}`);
            
            if (apiError.code === 'ECONNREFUSED') {
                console.log('   Backend server is not running on port 3000');
                console.log('   Please start the backend server first');
            } else if (apiError.response?.status === 401) {
                console.log('   Authentication required - testing with auth');
                // Could test with authentication here
            }
        }
        
        // 3. Check Product-Category Relationships
        console.log('\n🔗 3. Checking Product-Category Relationships...');
        
        const [productCategoryStats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN category IS NOT NULL AND category != '' THEN 1 END) as products_with_category,
                COUNT(DISTINCT category) as unique_categories_in_products
            FROM products
        `);
        
        const stats = productCategoryStats[0];
        console.log(`   Total products: ${stats.total_products}`);
        console.log(`   Products with category: ${stats.products_with_category}`);
        console.log(`   Unique categories in products: ${stats.unique_categories_in_products}`);
        
        if (stats.products_with_category === 0) {
            console.log('❌ No products have categories assigned');
        } else {
            console.log('✅ Products have categories assigned');
        }
        
        // 4. Check Most Common Categories
        console.log('\n📊 4. Most Common Categories in Products...');
        const [topCategories] = await connection.execute(`
            SELECT category, COUNT(*) as count 
            FROM products 
            WHERE category IS NOT NULL AND category != ''
            GROUP BY category 
            ORDER BY count DESC 
            LIMIT 5
        `);
        
        topCategories.forEach(cat => {
            console.log(`   ${cat.category}: ${cat.count} products`);
        });
        
        // 5. Diagnosis and Recommendations
        console.log('\n🎯 5. DIAGNOSIS AND RECOMMENDATIONS');
        console.log('=' .repeat(50));
        
        if (categoryCount[0].count === 0) {
            console.log('❌ PROBLEM: Categories table is empty');
            console.log('   SOLUTION: Run category population script');
            console.log('   SCRIPT: sync_all_categories_from_siigo.js');
        } else if (stats.unique_categories_in_products > categoryCount[0].count) {
            console.log('⚠️  PROBLEM: More categories in products than in categories table');
            console.log('   SOLUTION: Sync categories table with products');
        } else {
            console.log('✅ Database categories look correct');
            console.log('   ISSUE: Likely frontend API call or authentication problem');
            console.log('   CHECK: Backend server running on port 3000');
            console.log('   CHECK: Frontend making correct API calls');
        }
        
    } catch (error) {
        console.error('❌ Database Error:', error.message);
        
        if (error.code === 'ER_NO_SUCH_TABLE') {
            console.log('❌ Categories table does not exist');
            console.log('   Run: node database/create_categories_table.js');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('❌ Cannot connect to database');
            console.log('   Check MySQL/MariaDB service is running');
        }
        
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the debug
debugCategoriesIssue().catch(console.error);
