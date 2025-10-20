const axios = require('axios');
require('dotenv').config();

async function testSiigoAuthenticationFixed() {
    console.log('🔐 Testing SIIGO Authentication with corrected environment variables...\n');
    
    // Verificar variables de entorno
    console.log('📋 Environment Variables:');
    console.log('SIIGO_API_USERNAME:', process.env.SIIGO_API_USERNAME ? '✅ Set' : '❌ Missing');
    console.log('SIIGO_API_ACCESS_KEY:', process.env.SIIGO_API_ACCESS_KEY ? '✅ Set' : '❌ Missing');
    console.log('');
    
    if (!process.env.SIIGO_API_USERNAME || !process.env.SIIGO_API_ACCESS_KEY) {
        console.log('❌ Missing required SIIGO credentials');
        return false;
    }
    
    try {
        // Test authentication
        console.log('🔐 Testing SIIGO Authentication...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        });
        
        console.log('✅ Authentication successful!');
        console.log('Token received:', authResponse.data.access_token ? '✅' : '❌');
        console.log('');
        
        const token = authResponse.data.access_token;
        
        // Test products API
        console.log('📦 Testing Products API...');
        const productsResponse = await axios.get('https://api.siigo.com/v1/products?page_size=5', {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Products API working!');
        console.log('Products found:', productsResponse.data.results?.length || 0);
        
        if (productsResponse.data.results?.length > 0) {
            const firstProduct = productsResponse.data.results[0];
            console.log('Sample product:');
            console.log('  - ID:', firstProduct.id);
            console.log('  - Code:', firstProduct.code);
            console.log('  - Name:', firstProduct.name);
            console.log('  - Available Quantity:', firstProduct.available_quantity);
        }
        console.log('');
        
        // Test specific product fetch
        if (productsResponse.data.results?.length > 0) {
            const productId = productsResponse.data.results[0].id;
            console.log(`🔍 Testing specific product fetch (${productId})...`);
            
            const productResponse = await axios.get(`https://api.siigo.com/v1/products/${productId}`, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Specific product fetch working!');
            console.log('Product stock:', productResponse.data.available_quantity);
        }
        
        console.log('🎉 All SIIGO API tests passed! Authentication is working correctly.');
        return true;
        
    } catch (error) {
        console.error('❌ Authentication failed:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
        console.error('Full error details:', JSON.stringify(error.response?.data, null, 2));
        return false;
    }
}

async function testStockSyncService() {
    console.log('\n📦 Testing StockSyncService class...\n');
    
    try {
        const StockSyncService = require('./backend/services/stockSyncService');
        const stockService = new StockSyncService();
        
        console.log('📋 StockSyncService configuration:');
        console.log('Username:', stockService.siigoConfig.username ? '✅ Set' : '❌ Missing');
        console.log('Access Key:', stockService.siigoConfig.access_key ? '✅ Set' : '❌ Missing');
        console.log('Base URL:', stockService.siigoConfig.baseUrl);
        console.log('');
        
        // Test authentication method
        console.log('🔐 Testing authenticate() method...');
        const authResult = await stockService.authenticate();
        
        if (authResult) {
            console.log('✅ StockSyncService authentication successful!');
            console.log('Token set:', stockService.token ? '✅' : '❌');
            console.log('Token expiry set:', stockService.tokenExpiry ? '✅' : '❌');
        } else {
            console.log('❌ StockSyncService authentication failed');
            return false;
        }
        
        // Test getStockStats method
        console.log('\n📊 Testing getStockStats() method...');
        const stats = await stockService.getStockStats();
        
        if (stats) {
            console.log('✅ Stock stats retrieved successfully!');
            console.log('Total products:', stats.products.total_products);
            console.log('Synced products:', stats.products.synced_products);
            console.log('Updated today:', stats.products.updated_today);
            console.log('Webhooks configured:', stats.webhooksConfigured ? '✅' : '❌');
            console.log('Sync running:', stats.syncRunning ? '✅' : '❌');
        } else {
            console.log('⚠️ Could not retrieve stock stats (database might need setup)');
        }
        
        console.log('\n🎉 StockSyncService tests completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ StockSyncService test failed:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

async function main() {
    console.log('🚀 Testing Fixed SIIGO Stock Sync System\n');
    console.log('='.repeat(60));
    
    const authSuccess = await testSiigoAuthenticationFixed();
    
    if (authSuccess) {
        console.log('\n' + '='.repeat(60));
        await testStockSyncService();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 Tests completed!');
}

main().catch(console.error);
