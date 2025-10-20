const axios = require('axios');

async function testAnalyticsWithCorrectToken() {
    console.log('\n=== TESTING ANALYTICS WITH CORRECT TOKEN EXTRACTION ===');
    
    try {
        // Step 1: Login with correct credentials
        console.log('\n1. Logging in...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        console.log('Login response status:', loginResponse.status);
        console.log('Login response structure:', JSON.stringify(loginResponse.data, null, 2));

        // Step 2: Extract token from correct nested path
        const token = loginResponse.data.data.token; // FIX: Correct path
        console.log('\nExtracted token (first 50 chars):', token ? token.substring(0, 50) + '...' : 'TOKEN IS UNDEFINED');

        if (!token) {
            throw new Error('Token extraction failed - token is undefined');
        }

        // Step 3: Test analytics endpoint with correct token
        console.log('\n2. Testing analytics endpoint...');
        const analyticsResponse = await axios.get('http://localhost:3001/api/analytics/advanced-dashboard', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Analytics response status:', analyticsResponse.status);
        console.log('Analytics response:', JSON.stringify(analyticsResponse.data, null, 2));

        // Step 4: Check if we have real data instead of empty object
        if (analyticsResponse.data.success && Object.keys(analyticsResponse.data.data).length > 0) {
            console.log('\n✅ SUCCESS: Analytics endpoint returns real data!');
            console.log('Available analytics data sections:', Object.keys(analyticsResponse.data.data));
            
            // Show sample of each data section
            for (const [key, value] of Object.entries(analyticsResponse.data.data)) {
                if (Array.isArray(value)) {
                    console.log(`- ${key}: Array with ${value.length} items`);
                } else if (typeof value === 'object') {
                    console.log(`- ${key}: Object with keys:`, Object.keys(value));
                } else {
                    console.log(`- ${key}:`, value);
                }
            }
        } else {
            console.log('\n⚠️ WARNING: Analytics endpoint returns empty data');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testAnalyticsWithCorrectToken();
