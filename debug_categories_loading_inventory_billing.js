const axios = require('axios');

console.log('🔍 Debugging categories loading for inventory-billing page...\n');

async function debugCategoriesAPI() {
    try {
        // Test the categories API endpoint that the frontend should be using
        console.log('📡 Testing /api/siigo-categories/local endpoint...');
        
        const response = await axios.get('http://localhost:3001/api/siigo-categories/local', {
            timeout: 10000
        });
        
        console.log('✅ Response Status:', response.status);
        console.log('📊 Response Data:', JSON.stringify(response.data, null, 2));
        console.log('🔢 Number of categories:', response.data.length);
        
        if (response.data && response.data.length > 0) {
            console.log('\n📋 Available categories:');
            response.data.forEach((category, index) => {
                console.log(`   ${index + 1}. ${category}`);
            });
            
            // Check if our expected default categories are present
            const expectedCategories = [
                'GENIALITY',
                'LIQUIPOPS', 
                'MEZCLAS EN POLVO',
                'Productos No fabricados 19%',
                'YEXIS'
            ];
            
            console.log('\n✅ Checking for expected default categories:');
            expectedCategories.forEach(expectedCat => {
                const found = response.data.includes(expectedCat);
                console.log(`   ${found ? '✅' : '❌'} ${expectedCat}`);
            });
        } else {
            console.log('❌ No categories returned from API');
        }
        
    } catch (error) {
        console.error('❌ Error testing categories API:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

async function debugFrontendAPICall() {
    try {
        // Test with authentication header like the frontend would use
        console.log('\n🔐 Testing with authorization header...');
        
        // Get a token first (simulate login)
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Got auth token');
        
        // Test categories endpoint with auth
        const response = await axios.get('http://localhost:3001/api/siigo-categories/local', {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 10000
        });
        
        console.log('✅ Authenticated request successful');
        console.log('📊 Categories with auth:', response.data.length);
        
    } catch (error) {
        console.error('❌ Error with authenticated request:', error.message);
    }
}

async function main() {
    await debugCategoriesAPI();
    await debugFrontendAPICall();
}

main().catch(console.error);
