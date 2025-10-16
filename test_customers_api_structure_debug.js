const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function debugCustomersAPI() {
    console.log('🔍 Debugging Customers API Structure');
    console.log('=====================================');
    
    try {
        // Login
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data?.token;
        
        if (!token) {
            console.error('❌ No token received');
            return;
        }
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Get customers and inspect the exact structure
        const customersResponse = await axios.get(`${BASE_URL}/api/customers?search=`, { headers });
        
        console.log('✅ Customers API status:', customersResponse.status);
        console.log('📋 Full customers response structure:');
        console.log(JSON.stringify(customersResponse.data, null, 2));
        
        // Try different ways to access the data
        console.log('\n🔍 Testing different access patterns:');
        console.log('customersResponse.data:', typeof customersResponse.data);
        console.log('customersResponse.data.data:', typeof customersResponse.data?.data);
        console.log('customersResponse.data.data.data:', typeof customersResponse.data?.data?.data);
        
        // Check if there's a direct customers array
        console.log('customersResponse.data.customers:', typeof customersResponse.data?.customers);
        
        // Check length of various potential arrays
        if (customersResponse.data?.data?.data) {
            console.log('Length of data.data.data:', customersResponse.data.data.data.length);
        }
        
        if (customersResponse.data?.data) {
            console.log('Length of data.data:', Array.isArray(customersResponse.data.data) ? customersResponse.data.data.length : 'Not an array');
        }
        
        if (customersResponse.data?.customers) {
            console.log('Length of data.customers:', customersResponse.data.customers.length);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

debugCustomersAPI();
