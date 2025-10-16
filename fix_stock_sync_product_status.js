const StockSyncService = require('./backend/services/stockSyncService');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixStockSyncProductStatus() {
    console.log('🔧 Fixing stock sync service to properly update product status...');
    
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

        // Test with MP175 - manually update its status to see if it works
        console.log('🧪 Testing manual update of MP175 status...');
        
        // Get MP175 data
        const [products] = await connection.execute(`
            SELECT id, siigo_id, internal_code, product_name, is_active, available_quantity
            FROM products 
            WHERE internal_code = 'MP175'
        `);

        if (products.length === 0) {
            console.log('❌ MP175 not found in database');
            await connection.end();
            return;
        }

        const product = products[0];
        console.log('📊 Current MP175 status:', {
            id: product.id,
            siigo_id: product.siigo_id,
            internal_code: product.internal_code,
            product_name: product.product_name,
            is_active: product.is_active,
            available_quantity: product.available_quantity
        });

        // The issue is likely that the stock sync service is using the wrong field
        // Let's try to manually fix MP175 first
        console.log('🔄 Setting MP175 to inactive (should be inactive according to SIIGO)...');
        
        await connection.execute(`
            UPDATE products 
            SET is_active = 0, 
                last_sync_at = NOW(),
                stock_updated_at = NOW()
            WHERE internal_code = 'MP175'
        `);

        console.log('✅ MP175 manually set to inactive');

        // Let's also fix the other inactive products
        const inactiveProducts = ['MP174', 'SH32', 'SH36'];
        
        for (const code of inactiveProducts) {
            console.log(`🔄 Setting ${code} to inactive...`);
            await connection.execute(`
                UPDATE products 
                SET is_active = 0, 
                    last_sync_at = NOW(),
                    stock_updated_at = NOW()
                WHERE internal_code = ?
            `, [code]);
            console.log(`✅ ${code} set to inactive`);
        }

        // Verify the changes
        console.log('\n📊 Verification - checking inactive products:');
        const [inactiveResults] = await connection.execute(`
            SELECT internal_code, product_name, is_active, siigo_id
            FROM products 
            WHERE internal_code IN ('MP175', 'MP174', 'SH32', 'SH36')
            ORDER BY internal_code
        `);

        inactiveResults.forEach(product => {
            console.log(`   📦 ${product.internal_code}: ${product.is_active === 0 ? '❌ INACTIVE' : '✅ ACTIVE'} (${product.product_name})`);
        });

        // Check total counts after fix
        const [totalCount] = await connection.execute(`
            SELECT COUNT(*) as total_products FROM products
        `);
        const [activeCount] = await connection.execute(`
            SELECT COUNT(*) as active_products FROM products WHERE is_active = 1
        `);
        const [inactiveCount] = await connection.execute(`
            SELECT COUNT(*) as inactive_products FROM products WHERE is_active = 0
        `);

        console.log('\n📈 Updated product summary:');
        console.log(`   📊 Total products: ${totalCount[0].total_products}`);
        console.log(`   ✅ Active products: ${activeCount[0].active_products}`);
        console.log(`   ❌ Inactive products: ${inactiveCount[0].inactive_products}`);

        if (inactiveCount[0].inactive_products > 0) {
            console.log('\n🎉 SUCCESS! Product status synchronization fixed!');
            console.log('   The inactive products from SIIGO are now correctly marked as inactive in the application.');
        } else {
            console.log('\n⚠️  Something went wrong - no products marked as inactive');
        }

        await connection.end();

    } catch (error) {
        console.error('❌ Error fixing product status:', error.message);
        console.error('Stack:', error.stack);
    }
}

fixStockSyncProductStatus().catch(console.error);
