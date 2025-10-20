const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkInactiveProductsInDatabase() {
    console.log('🔍 Checking for inactive products (MP175, MP174, SH32, SH36) in database...');
    
    try {
        // Create database connection
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos',
            port: process.env.DB_PORT || 3306,
            charset: 'utf8mb4',
            timezone: '+00:00'
        });

        console.log('📊 Searching for products MP175, MP174, SH32, SH36...');
        
        // Search by siigo_id (internal code)
        const targetCodes = ['MP175', 'MP174', 'SH32', 'SH36'];
        
        for (const code of targetCodes) {
            const [products] = await connection.execute(`
                SELECT id, siigo_id, product_name, is_active, available_quantity, internal_code
                FROM products 
                WHERE siigo_id = ? OR internal_code = ? OR product_name LIKE ?
            `, [code, code, `%${code}%`]);

            console.log(`\n🔍 Results for ${code}:`);
            if (products.length === 0) {
                console.log(`   ❌ ${code} not found in database`);
            } else {
                products.forEach(product => {
                    console.log(`   ✅ Found:`, {
                        id: product.id,
                        siigo_id: product.siigo_id,
                        internal_code: product.internal_code,
                        product_name: product.product_name,
                        is_active: product.is_active,
                        available_quantity: product.available_quantity
                    });
                });
            }
        }

        // Check total product count and some samples
        console.log('\n📈 Database product summary:');
        const [totalCount] = await connection.execute(`
            SELECT COUNT(*) as total_products FROM products
        `);
        console.log(`   📊 Total products in database: ${totalCount[0].total_products}`);

        const [activeCount] = await connection.execute(`
            SELECT COUNT(*) as active_products FROM products WHERE is_active = 1
        `);
        console.log(`   ✅ Active products: ${activeCount[0].active_products}`);

        const [inactiveCount] = await connection.execute(`
            SELECT COUNT(*) as inactive_products FROM products WHERE is_active = 0
        `);
        console.log(`   ❌ Inactive products: ${inactiveCount[0].inactive_products}`);

        // Show some sample products with their SIIGO IDs
        console.log('\n🔍 Sample products with SIIGO IDs:');
        const [samples] = await connection.execute(`
            SELECT siigo_id, internal_code, product_name, is_active 
            FROM products 
            WHERE siigo_id IS NOT NULL 
            LIMIT 10
        `);

        samples.forEach(product => {
            console.log(`   📦 ${product.siigo_id || 'N/A'} | ${product.internal_code || 'N/A'} | ${product.product_name} | Active: ${product.is_active}`);
        });

        await connection.end();

    } catch (error) {
        console.error('❌ Error checking products:', error.message);
    }
}

checkInactiveProductsInDatabase().catch(console.error);
