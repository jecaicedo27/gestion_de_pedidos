const axios = require('axios');

console.log('🔍 Testing Frontend Customer Search Connection Issue');
console.log('==================================================');

async function testFrontendPerspective() {
    try {
        // Test 1: Check if backend is accessible from browser perspective
        console.log('1. Testing basic backend connectivity...');
        try {
            const response = await axios.get('http://localhost:3001/api/health', {
                timeout: 5000
            });
            console.log('✅ Backend is accessible');
        } catch (error) {
            console.log('❌ Backend not accessible:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.log('🚨 SOLUTION: Backend is not running! Start it with: npm run dev');
                return;
            }
        }

        // Test 2: Test CORS and preflight requests
        console.log('\n2. Testing CORS configuration...');
        try {
            const response = await axios.options('http://localhost:3001/api/quotations/customers/search', {
                headers: {
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'Authorization'
                },
                timeout: 5000
            });
            console.log('✅ CORS preflight successful');
        } catch (error) {
            console.log('❌ CORS preflight failed:', error.message);
        }

        // Test 3: Simulate frontend authentication
        console.log('\n3. Testing frontend authentication simulation...');
        
        // First login to get a fresh token like the frontend would
        let authToken = null;
        try {
            const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
                username: 'admin',
                password: 'admin123'
            }, {
                timeout: 5000
            });
            
            authToken = loginResponse.data.token;
            console.log('✅ Frontend authentication successful');
        } catch (error) {
            console.log('❌ Frontend authentication failed:', error.message);
            console.log('🚨 This could be why customer search fails!');
        }

        // Test 4: Test customer search with frontend-style request
        if (authToken) {
            console.log('\n4. Testing customer search with fresh frontend token...');
            try {
                const searchResponse = await axios.get('http://localhost:3001/api/quotations/customers/search', {
                    params: {
                        q: 'test'
                    },
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Origin': 'http://localhost:3000',
                        'Referer': 'http://localhost:3000/quotations'
                    },
                    timeout: 5000
                });
                
                console.log('✅ Customer search successful with frontend token');
                console.log(`Found ${searchResponse.data.customers?.length || 0} customers`);
            } catch (error) {
                console.log('❌ Customer search failed with frontend token:', error.message);
                if (error.response) {
                    console.log('Response status:', error.response.status);
                    console.log('Response data:', error.response.data);
                }
            }
        }

        // Test 5: Check if frontend is running
        console.log('\n5. Testing if frontend is running...');
        try {
            const frontendResponse = await axios.get('http://localhost:3000', {
                timeout: 5000
            });
            console.log('✅ Frontend is running on port 3000');
        } catch (error) {
            console.log('❌ Frontend not accessible:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.log('🚨 SOLUTION: Frontend is not running! Start it with: npm start');
            }
        }

        // Test 6: Test from frontend API service perspective
        console.log('\n6. Testing with exact frontend API configuration...');
        try {
            // Create axios instance like frontend does
            const apiClient = axios.create({
                baseURL: 'http://localhost:3001/api',
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Add request interceptor like frontend does
            apiClient.interceptors.request.use(config => {
                const token = authToken; // Simulate getting from localStorage
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            });

            const searchResponse = await apiClient.get('/quotations/customers/search', {
                params: { q: 'test' }
            });
            
            console.log('✅ Frontend API service simulation successful');
            console.log(`Found ${searchResponse.data.customers?.length || 0} customers`);
            
        } catch (error) {
            console.log('❌ Frontend API service simulation failed:', error.message);
            console.log('🚨 This is likely the exact error the frontend is experiencing!');
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Data:', error.response.data);
            }
            if (error.code) {
                console.log('Error code:', error.code);
            }
        }

    } catch (error) {
        console.log('❌ General error:', error.message);
    }
}

// Run the test
testFrontendPerspective().then(() => {
    console.log('\n==================================================');
    console.log('🎯 FRONTEND CUSTOMER SEARCH DIAGNOSIS COMPLETED');
    console.log('==================================================');
});
