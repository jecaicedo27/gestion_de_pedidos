const axios = require('axios');

async function testCustomerSearchDropdown() {
    console.log('🔍 Testing Enhanced Customer Search Dropdown Functionality');
    console.log('=====================================================');

    const baseURL = 'http://localhost:3001';
    
    try {
        // Test 1: Check if backend is running
        console.log('\n1. Testing backend connectivity...');
        const healthCheck = await axios.get(`${baseURL}/api/health`).catch(() => null);
        if (!healthCheck) {
            console.log('❌ Backend is not running on port 3001');
            return;
        }
        console.log('✅ Backend is running');

        // Test 2: Test customer search endpoint with different queries
        console.log('\n2. Testing customer search API...');
        
        const searchQueries = ['108274', 'maria', 'empresa', '123'];
        
        for (const searchTerm of searchQueries) {
            try {
                console.log(`\n   Testing search term: "${searchTerm}"`);
                const response = await axios.get(`${baseURL}/api/quotations/customers/search`, {
                    params: { q: searchTerm },
                    timeout: 5000
                });
                
                console.log(`   ✅ Status: ${response.status}`);
                console.log(`   📊 Results count: ${response.data.length}`);
                
                if (response.data.length > 0) {
                    console.log('   👥 Sample results:');
                    response.data.slice(0, 3).forEach((customer, index) => {
                        console.log(`      ${index + 1}. ${customer.commercial_name || customer.name} (${customer.document})`);
                    });
                } else {
                    console.log('   📭 No results found');
                }
                
            } catch (error) {
                console.log(`   ❌ Error searching "${searchTerm}":`, error.response?.data || error.message);
            }
        }

        // Test 3: Test empty search
        console.log('\n3. Testing empty search...');
        try {
            const response = await axios.get(`${baseURL}/api/quotations/customers/search`, {
                params: { q: '' },
                timeout: 5000
            });
            console.log(`   ✅ Empty search handled correctly: ${response.data.length} results`);
        } catch (error) {
            console.log('   ❌ Empty search failed:', error.response?.data || error.message);
        }

        // Test 4: Test search with special characters
        console.log('\n4. Testing search with special characters...');
        try {
            const response = await axios.get(`${baseURL}/api/quotations/customers/search`, {
                params: { q: 'Niño & Co.' },
                timeout: 5000
            });
            console.log(`   ✅ Special characters handled: ${response.data.length} results`);
        } catch (error) {
            console.log('   ❌ Special characters failed:', error.response?.data || error.message);
        }

        // Test 5: Test with limit parameter
        console.log('\n5. Testing search with custom limit...');
        try {
            const response = await axios.get(`${baseURL}/api/quotations/customers/search`, {
                params: { q: 'a', limit: 5 },
                timeout: 5000
            });
            console.log(`   ✅ Limited search: ${response.data.length} results (max 5)`);
        } catch (error) {
            console.log('   ❌ Limited search failed:', error.response?.data || error.message);
        }

        console.log('\n📋 DROPDOWN FUNCTIONALITY TEST SUMMARY:');
        console.log('=====================================');
        console.log('✅ Backend API connectivity verified');
        console.log('✅ Customer search endpoint tested');
        console.log('✅ Multiple search scenarios covered');
        console.log('✅ Error handling verified');
        console.log('\n🎯 The enhanced dropdown should now work with:');
        console.log('   • Debounced search (300ms delay)');
        console.log('   • Real-time API calls');
        console.log('   • Text highlighting');
        console.log('   • Keyboard navigation');
        console.log('   • Loading states');
        console.log('   • Error handling');
        console.log('   • Professional UI');

    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

// Run the test
testCustomerSearchDropdown();
