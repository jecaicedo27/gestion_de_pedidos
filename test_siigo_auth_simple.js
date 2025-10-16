const axios = require('axios');
require('dotenv').config();

async function testSiigoAuth() {
    console.log('🔍 Testing SIIGO authentication...\n');
    
    // Check environment variables
    console.log('Environment variables:');
    console.log('SIIGO_API_USERNAME:', process.env.SIIGO_API_USERNAME);
    console.log('SIIGO_API_ACCESS_KEY:', process.env.SIIGO_API_ACCESS_KEY ? 'SET' : 'NOT SET');
    console.log('DB_NAME:', process.env.DB_NAME);
    
    if (!process.env.SIIGO_API_USERNAME || !process.env.SIIGO_API_ACCESS_KEY) {
        console.log('❌ Missing SIIGO credentials in environment');
        return;
    }
    
    try {
        console.log('\n🔐 Attempting SIIGO authentication...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Authentication successful!');
        console.log('Token:', authResponse.data.access_token.substring(0, 20) + '...');
        console.log('Expires in:', authResponse.data.expires_in);
        
        // Test a simple API call
        const token = authResponse.data.access_token;
        console.log('\n🧪 Testing API call with token...');
        
        const testResponse = await axios.get('https://api.siigo.com/v1/products?page=1&page_size=1', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            }
        });
        
        console.log('✅ API call successful!');
        console.log('Products found:', testResponse.data.results?.length || 0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testSiigoAuth();
