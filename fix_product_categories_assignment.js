const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function fixProductCategoriesAssignment() {
    console.log('🔧 FIXING PRODUCT CATEGORIES ASSIGNMENT');
    console.log('=' .repeat(60));
    
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos',
            port: process.env.DB_PORT || 3306
        });
        
        console.log('✅ Connected to database');
        
        // 1. Show current status
        console.log('\n📊 1. Current Status Analysis...');
        
        const [currentStatus] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN category = 'Sin categoría' THEN 1 END) as without_category,
                COUNT(DISTINCT category) as unique_categories
            FROM products
        `);
        
        const status = currentStatus[0];
        console.log(`   Total products: ${status.total_products}`);
        console.log(`   Products without category: ${status.without_category}`);
        console.log(`   Unique categories in products: ${status.unique_categories}`);
        
        if (status.without_category === 0) {
            console.log('✅ All products already have proper categories assigned');
            return;
        }
        
        // 2. Get available categories from the categories table
        const [availableCategories] = await connection.execute(`
            SELECT id, name, siigo_id 
            FROM categories 
            ORDER BY name
        `);
        
        console.log(`\n📋 2. Available Categories (${availableCategories.length}):`);
        availableCategories.forEach(cat => {
            console.log(`   - ${cat.id}: ${cat.name} (SIIGO ID: ${cat.siigo_id})`);
        });
        
        // 3. Strategy: Assign products to categories based on product name patterns and existing SIIGO data
        console.log('\n🎯 3. Assigning Categories to Products...');
        
        let updated = 0;
        
        // Strategy 1: Assign LIQUIPOPS products
        const [liquipopsUpdate] = await connection.execute(`
            UPDATE products 
            SET category = 'LIQUIPOPS'
            WHERE (product_name LIKE '%LIQUIP%' OR internal_code LIKE '%LIQUIP%')
            AND category = 'Sin categoría'
        `);
        updated += liquipopsUpdate.affectedRows;
        console.log(`   ✅ Assigned ${liquipopsUpdate.affectedRows} products to LIQUIPOPS`);
        
        // Strategy 2: Assign MEZCLAS EN POLVO products
        const [mezclasUpdate] = await connection.execute(`
            UPDATE products 
            SET category = 'MEZCLAS EN POLVO'
            WHERE (product_name LIKE '%MEZCLA%' OR product_name LIKE '%POLVO%' OR product_name LIKE '%MIX%')
            AND category = 'Sin categoría'
        `);
        updated += mezclasUpdate.affectedRows;
        console.log(`   ✅ Assigned ${mezclasUpdate.affectedRows} products to MEZCLAS EN POLVO`);
        
        // Strategy 3: Assign GENIALITY products
        const [genialityUpdate] = await connection.execute(`
            UPDATE products 
            SET category = 'GENIALITY'
            WHERE (product_name LIKE '%GENIALITY%' OR internal_code LIKE '%GEN%')
            AND category = 'Sin categoría'
        `);
        updated += genialityUpdate.affectedRows;
        console.log(`   ✅ Assigned ${genialityUpdate.affectedRows} products to GENIALITY`);
        
        // Strategy 4: Assign Materia prima products based on product name patterns
        const [materiaPrimaUpdate] = await connection.execute(`
            UPDATE products 
            SET category = 'Materia prima gravadas 19%'
            WHERE (product_name LIKE '%MATERIA%' OR 
                   product_name LIKE '%INGREDIENTE%' OR 
                   product_name LIKE '%CONSERVANTE%' OR
                   product_name LIKE '%COLORANTE%' OR
                   product_name LIKE '%SABORIZANTE%' OR
                   product_name LIKE '%MP%')
            AND category = 'Sin categoría'
        `);
        updated += materiaPrimaUpdate.affectedRows;
        console.log(`   ✅ Assigned ${materiaPrimaUpdate.affectedRows} products to Materia prima gravadas 19%`);
        
        // Strategy 5: Assign products based on common naming patterns
        const [productosUpdate] = await connection.execute(`
            UPDATE products 
            SET category = 'Productos No fabricados 19%'
            WHERE (product_name LIKE '%ML%' OR 
                   product_name LIKE '%GR%' OR 
                   product_name LIKE '%UNIDAD%' OR
                   internal_code LIKE '%P%')
            AND category = 'Sin categoría'
            AND NOT (product_name LIKE '%LIQUIP%' OR product_name LIKE '%MATERIA%')
        `);
        updated += productosUpdate.affectedRows;
        console.log(`   ✅ Assigned ${productosUpdate.affectedRows} products to Productos No fabricados 19%`);
        
        // Strategy 6: Assign remaining products to a default category
        const [remainingUpdate] = await connection.execute(`
            UPDATE products 
            SET category = 'Productos No fabricados 19%'
            WHERE category = 'Sin categoría'
        `);
        updated += remainingUpdate.affectedRows;
        console.log(`   ✅ Assigned ${remainingUpdate.affectedRows} remaining products to Productos No fabricados 19%`);
        
        // 4. Verify results
        console.log('\n📊 4. Verification After Assignment...');
        
        const [finalStatus] = await connection.execute(`
            SELECT 
                category,
                COUNT(*) as count
            FROM products 
            GROUP BY category 
            ORDER BY count DESC
        `);
        
        console.log('   📋 Products by category:');
        finalStatus.forEach(cat => {
            console.log(`      ${cat.category}: ${cat.count} products`);
        });
        
        const [withoutCategoryCheck] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM products 
            WHERE category = 'Sin categoría'
        `);
        
        const remainingWithoutCategory = withoutCategoryCheck[0].count;
        
        // 5. Summary
        console.log('\n🎯 5. ASSIGNMENT SUMMARY');
        console.log('=' .repeat(50));
        console.log(`   Products updated: ${updated}`);
        console.log(`   Products still without category: ${remainingWithoutCategory}`);
        
        if (remainingWithoutCategory === 0) {
            console.log('✅ SUCCESS: All products now have categories assigned!');
            console.log('   The frontend dropdown should now show all available categories.');
        } else {
            console.log(`⚠️  Some products still need manual category assignment`);
        }
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('   1. Start the backend server (if not running)');
        console.log('   2. Refresh the inventory page');
        console.log('   3. Check that all categories appear in dropdown');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the fix
fixProductCategoriesAssignment().catch(console.error);
