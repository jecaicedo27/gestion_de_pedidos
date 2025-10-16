const StockSyncService = require('./backend/services/stockSyncService');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function testStockSyncMP175() {
    console.log('🔄 Testing stock sync service with MP175 (inactive product)...');
    
    const stockSync = new StockSyncService();
    
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

        // Check current status of MP175 in database
        console.log('📊 Checking current MP175 status in database...');
        const [products] = await connection.execute(`
            SELECT id, siigo_id, product_name, is_active, available_quantity
            FROM products 
            WHERE siigo_id = 'MP175'
        `);

        if (products.length === 0) {
            console.log('❌ MP175 not found in database');
            return;
        }

        const product = products[0];
        console.log('🔍 Current MP175 status in database:', {
            id: product.id,
            siigo_id: product.siigo_id,
            product_name: product.product_name,
            is_active: product.is_active,
            available_quantity: product.available_quantity
        });

        // Test the specific product sync
        console.log('\n🔄 Running stock sync for MP175...');
        const updated = await stockSync.syncSpecificProduct('MP175');
        
        console.log(`📈 Sync result: ${updated ? 'Updated' : 'No changes'}`);

        // Check status after sync
        const [updatedProducts] = await connection.execute(`
            SELECT id, siigo_id, product_name, is_active, available_quantity, last_sync_at
            FROM products 
            WHERE siigo_id = 'MP175'
        `);

        const updatedProduct = updatedProducts[0];
        console.log('📊 MP175 status after sync:', {
            id: updatedProduct.id,
            siigo_id: updatedProduct.siigo_id,
            product_name: updatedProduct.product_name,
            is_active: updatedProduct.is_active,
            available_quantity: updatedProduct.available_quantity,
            last_sync_at: updatedProduct.last_sync_at
        });

        // Verify the fix
        if (updatedProduct.is_active === 0) {
            console.log('✅ SUCCESS! MP175 is now correctly marked as INACTIVE');
        } else {
            console.log('❌ ISSUE: MP175 is still marked as ACTIVE when it should be INACTIVE');
        }

        await connection.end();

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testStockSyncMP175().catch(console.error);
