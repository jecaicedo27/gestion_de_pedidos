const axios = require('axios');

async function debugTokenFormat() {
    console.log('🔍 Debugging JWT Token Format Issue');
    console.log('=' .repeat(50));

    try {
        // Step 1: Login and inspect the full response
        console.log('1. Testing login and inspecting response...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        console.log('✅ Login Response Status:', loginResponse.status);
        console.log('📋 Full Response Data:', JSON.stringify(loginResponse.data, null, 2));
        
        // Step 2: Extract and analyze token - FIX: Token is nested under data.data.token
        const token = loginResponse.data.data?.token;
        console.log('\n🔍 Token Analysis:');
        console.log('Token length:', token ? token.length : 'undefined');
        console.log('Token type:', typeof token);
        console.log('Token starts with:', token ? token.substring(0, 20) + '...' : 'N/A');
        console.log('🔍 ISSUE FOUND: Token path should be data.data.token, not data.token');
        
        // Check if token has proper JWT structure (header.payload.signature)
        if (token) {
            const tokenParts = token.split('.');
            console.log('Token parts count:', tokenParts.length);
            console.log('Expected: 3 parts for valid JWT');
            
            if (tokenParts.length === 3) {
                console.log('✅ Token has correct JWT structure');
                console.log('Header length:', tokenParts[0].length);
                console.log('Payload length:', tokenParts[1].length);
                console.log('Signature length:', tokenParts[2].length);
            } else {
                console.log('❌ Token does NOT have correct JWT structure');
                console.log('Token value:', token);
            }
        }

        // Step 3: Test using the token in a request
        console.log('\n2. Testing token usage in API request...');
        const testResponse = await axios.get('http://localhost:3001/api/products', {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ Token works! Products API response status:', testResponse.status);
        console.log('Products count:', testResponse.data.length);

    } catch (error) {
        console.error('\n❌ Error during debug:');
        console.error('Status:', error.response?.status);
        console.error('Message:', error.message);
        console.error('Response data:', error.response?.data);
        
        if (error.response?.status === 401) {
            console.log('\n💡 Token authentication failed. This confirms the JWT format issue.');
        }
    }
}

debugTokenFormat();
