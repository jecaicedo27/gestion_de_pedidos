const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function debugLogin() {
    console.log('🔍 Debugging Login Response');
    console.log('==========================\n');

    try {
        console.log('🔐 Attempting login...');
        const response = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        console.log('\n✅ Login successful!');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('\n📦 Response data:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Check various possible token locations
        console.log('\n🔍 Checking for token in response:');
        console.log('- response.data.token:', response.data.token);
        console.log('- response.data.accessToken:', response.data.accessToken);
        console.log('- response.data.access_token:', response.data.access_token);
        console.log('- response.data.authToken:', response.data.authToken);
        console.log('- response.data.user?.token:', response.data.user?.token);
        
        // If we find a token, test it
        const token = response.data.token || response.data.accessToken || response.data.access_token;
        if (token) {
            console.log('\n🎯 Token found:', token.substring(0, 50) + '...');
            
            // Test the token
            console.log('\n🧪 Testing token with customer search...');
            try {
                const testResponse = await axios.get(`${API_URL}/quotations/customers/search`, {
                    params: { q: '1082746400' },
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                console.log('✅ Token works! Customer search returned:', testResponse.data.length, 'results');
            } catch (error) {
                console.log('❌ Token test failed:', error.response?.status, error.response?.data);
            }
        } else {
            console.log('\n⚠️ No token found in response');
        }

    } catch (error) {
        console.error('\n❌ Login failed:');
        console.error('Status:', error.response?.status);
        console.error('Error:', error.response?.data || error.message);
    }
}

// Run the debug
debugLogin();
