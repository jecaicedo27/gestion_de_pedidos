const axios = require('axios');

async function testCustomerSearchFunctionality() {
    console.log('🔍 Testing Customer Search Functionality');
    console.log('=' .repeat(50));

    const baseURL = 'http://localhost:3001';
    
    try {
        // Step 1: Login to get authentication token
        console.log('\n1. Getting authentication token...');
        
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Authentication successful');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Step 2: Test customer search endpoint
        console.log('\n2. Testing customer search endpoint...');
        
        // Test with empty search (should fail)
        try {
            const emptyResponse = await axios.get(
                `${baseURL}/api/quotations/customers/search?q=`,
                { headers }
            );
            console.log('❌ Empty search should have failed but succeeded');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Empty search properly rejected (400 error)');
            } else {
                console.log('❌ Unexpected error for empty search:', error.message);
            }
        }

        // Test with short search (should fail)
        try {
            const shortResponse = await axios.get(
                `${baseURL}/api/quotations/customers/search?q=a`,
                { headers }
            );
            console.log('❌ Short search should have failed but succeeded');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Short search properly rejected (400 error)');
            } else {
                console.log('❌ Unexpected error for short search:', error.message);
            }
        }

        // Test with valid search terms
        const searchTerms = ['10', 'test', 'cliente', 'jose', 'maria', 'empresa'];
        
        for (const searchTerm of searchTerms) {
            console.log(`\n3. Testing search with term: "${searchTerm}"`);
            
            try {
                const searchResponse = await axios.get(
                    `${baseURL}/api/quotations/customers/search?q=${encodeURIComponent(searchTerm)}`,
                    { headers }
                );

                if (searchResponse.data.success) {
                    console.log(`✅ Search successful for "${searchTerm}"`);
                    console.log(`   Found ${searchResponse.data.data.length} customers`);
                    
                    // Show first few results
                    if (searchResponse.data.data.length > 0) {
                        console.log('   Sample results:');
                        searchResponse.data.data.slice(0, 3).forEach((customer, index) => {
                            console.log(`   ${index + 1}. ${customer.name} (${customer.document || 'No document'})`);
                        });
                    }
                } else {
                    console.log(`❌ Search failed for "${searchTerm}": ${searchResponse.data.message}`);
                }
            } catch (error) {
                console.log(`❌ Error searching for "${searchTerm}":`, error.response?.data || error.message);
            }
        }

        // Step 4: Test customer service directly
        console.log('\n4. Testing customerService directly...');
        
        try {
            // We'll test the database connection
            const testDbResponse = await axios.get(
                `${baseURL}/api/quotations/customers/stats`,
                { headers }
            );
            
            if (testDbResponse.data.success) {
                console.log('✅ Customer service and database connection working');
                console.log('   Customer stats:', testDbResponse.data.data);
            } else {
                console.log('❌ Customer service failed:', testDbResponse.data.message);
            }
        } catch (error) {
            console.log('❌ Error testing customer service:', error.response?.data || error.message);
        }

        return true;

    } catch (error) {
        console.error('\n❌ TEST FAILED:');
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ Connection Error: Backend server not running');
            console.error('   Solution: Start backend server with: node backend/server.js');
        } else {
            console.error('Error:', error.message);
        }
        
        return false;
    }
}

// Run the test
testCustomerSearchFunctionality()
    .then(success => {
        console.log('\n' + '=' .repeat(50));
        if (success) {
            console.log('🎉 CUSTOMER SEARCH TESTS COMPLETED');
        } else {
            console.log('💥 CUSTOMER SEARCH TESTS FAILED');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
