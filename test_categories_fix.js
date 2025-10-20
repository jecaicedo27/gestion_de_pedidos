const axios = require('axios');

async function testCategoriesAfterFix() {
    console.log('=== TESTING CATEGORIES ENDPOINT AFTER FIX ===');
    
    try {
        console.log('🔍 Testing /siigo-categories/live endpoint WITHOUT authentication...');
        
        const response = await axios.get('http://localhost:3001/api/siigo-categories/live', {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response Status:', response.status);
        console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
        
        if (response.data?.success && Array.isArray(response.data?.data)) {
            console.log('\n🏷️ Categories Returned:');
            response.data.data.forEach((category, index) => {
                console.log(`   ${index + 1}. "${category}"`);
            });
            
            // Check if we're getting the correct categories now
            const wrongCategories = ['Excluded', 'Exempt', 'Product', 'Service', 'Taxed'];
            const correctCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS', 'SKARCHA NO FABRICADOS 19%'];
            
            const hasWrongCategories = response.data.data.some(cat => wrongCategories.includes(cat));
            const hasCorrectCategories = response.data.data.some(cat => correctCategories.includes(cat));
            
            console.log('\n🚨 VERIFICATION:');
            console.log(`   Wrong Categories (fiscal): ${hasWrongCategories ? '❌ STILL PRESENT' : '✅ REMOVED'}`);
            console.log(`   Correct Categories (product): ${hasCorrectCategories ? '✅ PRESENT' : '❌ MISSING'}`);
            
            if (hasCorrectCategories && !hasWrongCategories) {
                console.log('\n✅ SUCCESS! Categories are now showing correctly!');
                console.log('📌 The inventory-billing page should now display the correct product categories.');
            } else if (hasWrongCategories) {
                console.log('\n⚠️ Still showing fiscal categories. Database query might be the issue.');
            } else {
                console.log('\n⚠️ Categories returned but not matching expected values.');
            }
        } else {
            console.log('❌ Invalid response format');
        }
        
    } catch (error) {
        if (error.response) {
            console.error('❌ HTTP Error:', error.response.status);
            console.error('📄 Error Data:', error.response.data);
            if (error.response.status === 401) {
                console.log('⚠️ Still getting authentication error! Backend might need restart.');
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ Backend not running! Need to restart it.');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testCategoriesAfterFix();
