const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

async function testMP175SiigoAPI() {
    console.log('🔍 Testing MP175 product status in SIIGO API...');
    
    try {
        // Step 1: Authenticate
        console.log('🔐 Authenticating with SIIGO API...');
        
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        });

        const token = authResponse.data.access_token;
        console.log('✅ Authentication successful');

        // Step 2: Test different API endpoints to find working one
        const productCode = 'MP175';
        
        console.log(`\n🧪 Testing API endpoint 1: /v1/products?code=${productCode}`);
        try {
            const response1 = await axios.get(
                `https://api.siigo.com/v1/products?code=${productCode}`,
                {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    }
                }
            );
            console.log('✅ Endpoint 1 works');
            console.log('📊 Response:', JSON.stringify(response1.data, null, 2));
        } catch (error) {
            console.log('❌ Endpoint 1 failed:', error.response?.status, error.response?.statusText);
            console.log('📄 Error details:', error.response?.data);
        }

        console.log(`\n🧪 Testing API endpoint 2: /v1/products/${productCode}`);
        try {
            const response2 = await axios.get(
                `https://api.siigo.com/v1/products/${productCode}`,
                {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    }
                }
            );
            console.log('✅ Endpoint 2 works');
            console.log('📊 Response:', JSON.stringify(response2.data, null, 2));
        } catch (error) {
            console.log('❌ Endpoint 2 failed:', error.response?.status, error.response?.statusText);
            console.log('📄 Error details:', error.response?.data);
        }

        console.log(`\n🧪 Testing API endpoint 3: /v1/products with search`);
        try {
            const response3 = await axios.get(
                `https://api.siigo.com/v1/products`,
                {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    },
                    params: {
                        code: productCode
                    }
                }
            );
            console.log('✅ Endpoint 3 works');
            console.log('📊 Response:', JSON.stringify(response3.data, null, 2));
        } catch (error) {
            console.log('❌ Endpoint 3 failed:', error.response?.status, error.response?.statusText);
            console.log('📄 Error details:', error.response?.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('📄 Error details:', error.response.data);
        }
    }
}

testMP175SiigoAPI().catch(console.error);
