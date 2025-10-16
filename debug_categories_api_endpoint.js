const axios = require('axios');

async function testCategoriesEndpoint() {
    console.log('=== DEBUGGING CATEGORIES API ENDPOINT ===');
    
    try {
        console.log('🔍 Testing /siigo-categories/live endpoint directly...');
        
        // Test the endpoint without authentication first
        const response = await axios.get('http://localhost:3001/siigo-categories/live', {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response Status:', response.status);
        console.log('📦 Response Data Structure:', {
            success: response.data?.success,
            dataType: Array.isArray(response.data?.data) ? 'Array' : typeof response.data?.data,
            dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'N/A',
            message: response.data?.message
        });
        
        console.log('🏷️ Categories Returned:');
        if (response.data?.success && Array.isArray(response.data?.data)) {
            response.data.data.forEach((category, index) => {
                console.log(`   ${index + 1}. "${category}"`);
            });
            
            // Check if we're getting the wrong categories (fiscal)
            const wrongCategories = ['Excluded', 'Exempt', 'Product', 'Service', 'Taxed'];
            const correctCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS', 'SKARCHA NO FABRICADOS 19%'];
            
            const hasWrongCategories = response.data.data.some(cat => wrongCategories.includes(cat));
            const hasCorrectCategories = response.data.data.some(cat => correctCategories.includes(cat));
            
            console.log('\n🚨 ANALYSIS:');
            console.log(`   Wrong Categories (fiscal): ${hasWrongCategories ? '❌ FOUND' : '✅ NOT FOUND'}`);
            console.log(`   Correct Categories (product): ${hasCorrectCategories ? '✅ FOUND' : '❌ NOT FOUND'}`);
            
            if (hasWrongCategories) {
                console.log('\n❌ PROBLEM IDENTIFIED: Backend is still returning fiscal categories!');
                console.log('   The backend endpoint is not working as expected.');
                console.log('   Need to check why the database query is not working.');
            } else if (hasCorrectCategories) {
                console.log('\n✅ Backend is working correctly!');
                console.log('   The issue might be frontend caching or other factors.');
            } else {
                console.log('\n⚠️ Unknown categories being returned.');
            }
        } else {
            console.log('❌ Invalid response format or no data returned');
        }
        
    } catch (error) {
        if (error.response) {
            console.error('❌ HTTP Error:', error.response.status);
            console.error('📄 Error Data:', error.response.data);
        } else if (error.request) {
            console.error('❌ Network Error: No response received');
            console.error('🔌 Make sure backend is running on localhost:3001');
        } else {
            console.error('❌ Request Error:', error.message);
        }
    }
}

// Test the local fallback endpoint too
async function testLocalCategoriesEndpoint() {
    console.log('\n=== TESTING LOCAL CATEGORIES ENDPOINT ===');
    
    try {
        console.log('🔍 Testing /siigo-categories/local endpoint...');
        
        const response = await axios.get('http://localhost:3001/siigo-categories/local', {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response Status:', response.status);
        console.log('📦 Response Data Structure:', {
            success: response.data?.success,
            dataType: Array.isArray(response.data?.data) ? 'Array' : typeof response.data?.data,
            dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'N/A'
        });
        
        console.log('🏷️ Local Categories:');
        if (response.data?.success && Array.isArray(response.data?.data)) {
            response.data.data.forEach((category, index) => {
                console.log(`   ${index + 1}. "${category}"`);
            });
        }
        
    } catch (error) {
        console.error('❌ Local endpoint error:', error.response?.data || error.message);
    }
}

// Run both tests
async function runAllTests() {
    await testCategoriesEndpoint();
    await testLocalCategoriesEndpoint();
    
    console.log('\n=== RECOMMENDATIONS ===');
    console.log('1. If backend returns fiscal categories: Backend fix not working');
    console.log('2. If backend returns correct categories: Frontend caching issue');
    console.log('3. If backend is not running: Need to start backend server');
}

runAllTests();
