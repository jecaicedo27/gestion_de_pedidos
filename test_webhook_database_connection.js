const WebhookService = require('./backend/services/webhookService');

async function testWebhookDatabaseConnection() {
    console.log('🧪 Testing webhook service database connection...\n');
    
    const webhookService = new WebhookService();
    
    try {
        console.log('1️⃣ Testing database connection...');
        const connection = await webhookService.getConnection();
        console.log('✅ Database connection successful');
        
        console.log('\n2️⃣ Testing products table query...');
        const [products] = await connection.execute(`
            SELECT id, product_name, available_quantity, siigo_id 
            FROM products 
            WHERE is_active = 1 
            LIMIT 5
        `);
        
        console.log(`✅ Found ${products.length} active products:`);
        products.forEach(product => {
            console.log(`   - ID: ${product.id}, SIIGO_ID: ${product.siigo_id}, Name: ${product.product_name?.substring(0, 50)}...`);
        });
        
        if (products.length > 0) {
            const testProduct = products[0];
            console.log(`\n3️⃣ Testing specific product query with SIIGO ID: ${testProduct.siigo_id}`);
            
            const [specificProduct] = await connection.execute(`
                SELECT id, product_name, available_quantity 
                FROM products 
                WHERE siigo_id = ? 
                AND is_active = 1
            `, [testProduct.siigo_id]);
            
            if (specificProduct.length > 0) {
                console.log('✅ Specific product query successful');
                console.log('   Product found:', {
                    id: specificProduct[0].id,
                    name: specificProduct[0].product_name?.substring(0, 50) + '...',
                    stock: specificProduct[0].available_quantity
                });
            } else {
                console.log('❌ Specific product query returned no results');
            }
            
            console.log('\n4️⃣ Testing webhook payload processing...');
            
            // Create a test payload with an existing product
            const testPayload = {
                topic: 'public.siigoapi.products.stock.update',
                id: testProduct.siigo_id,
                company_key: 'test',
                available_quantity: 999,
                name: testProduct.product_name,
                code: 'TEST123'
            };
            
            console.log('Test payload:', {
                topic: testPayload.topic,
                id: testPayload.id,
                available_quantity: testPayload.available_quantity
            });
            
            // Test the processStockUpdate method directly
            const result = await webhookService.processStockUpdate(connection, testPayload);
            console.log('✅ processStockUpdate result:', result);
            
        } else {
            console.log('❌ No products found to test with');
        }
        
        await connection.end();
        console.log('\n🎉 All database connection tests passed!');
        
    } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

async function testNonExistentProduct() {
    console.log('\n🧪 Testing webhook with non-existent product...\n');
    
    const webhookService = new WebhookService();
    
    try {
        const testPayload = {
            topic: 'public.siigoapi.products.stock.update',
            id: 'non-existent-product-id-12345',
            company_key: 'test',
            available_quantity: 100,
            name: 'Test Product',
            code: 'NONEXIST'
        };
        
        console.log('Testing with non-existent product ID:', testPayload.id);
        
        const result = await webhookService.processWebhookPayload(testPayload);
        console.log('✅ Webhook processing result:', result);
        
    } catch (error) {
        console.error('❌ Webhook processing failed:', error.message);
    }
}

async function main() {
    await testWebhookDatabaseConnection();
    await testNonExistentProduct();
}

main().catch(console.error);
