const axios = require('axios');

const API_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MjQ4MjYxMjN9.gJsj6HYX0c4tnt9J1SwUiv4KlPRUaIqvgWvE5QlDRLY';

async function testInventoryAPI() {
    console.log('🔍 Testing Inventory API and Products Loading...\n');
    
    try {
        // 1. Test backend connectivity
        console.log('1. Testing backend connectivity...');
        try {
            const health = await axios.get(`${API_URL}/health`);
            console.log('✅ Backend is running');
        } catch (error) {
            console.log('❌ Backend health check failed:', error.message);
        }
        
        // 2. Test inventory/grouped endpoint
        console.log('\n2. Testing /api/inventory/grouped endpoint...');
        const inventoryResponse = await axios.get(`${API_URL}/api/inventory/grouped`, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        
        if (inventoryResponse.data) {
            const products = inventoryResponse.data;
            console.log(`✅ Inventory API responded with ${products.length} product groups`);
            
            if (products.length > 0) {
                console.log('\n📦 Sample products:');
                products.slice(0, 3).forEach(group => {
                    console.log(`- ${group.name}: ${group.products?.length || 0} variants`);
                });
            } else {
                console.log('⚠️ No products returned from API');
            }
        }
        
        // 3. Test categories endpoint
        console.log('\n3. Testing /api/siigo-categories/live endpoint...');
        const categoriesResponse = await axios.get(`${API_URL}/api/siigo-categories/live`, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        
        if (categoriesResponse.data) {
            console.log(`✅ Categories API responded with ${categoriesResponse.data.length} categories`);
            if (categoriesResponse.data.length > 0) {
                console.log('📂 Available categories:', categoriesResponse.data.slice(0, 5).join(', '));
            }
        }
        
        // 4. Check products table directly
        console.log('\n4. Checking products_batch table directly...');
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos'
        });
        
        const [count] = await connection.execute('SELECT COUNT(*) as total FROM products_batch WHERE is_active = 1');
        console.log(`📊 Total active products in database: ${count[0].total}`);
        
        const [categories] = await connection.execute(`
            SELECT DISTINCT category, COUNT(*) as count 
            FROM products_batch 
            WHERE is_active = 1 AND category IS NOT NULL 
            GROUP BY category 
            ORDER BY count DESC
            LIMIT 10
        `);
        
        if (categories.length > 0) {
            console.log('\n📂 Product distribution by category:');
            categories.forEach(cat => {
                console.log(`  - ${cat.category}: ${cat.count} products`);
            });
        }
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Error testing inventory API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

testInventoryAPI();
