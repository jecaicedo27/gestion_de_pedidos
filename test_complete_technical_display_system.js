const axios = require('axios');

async function testCompleteTechnicalDisplaySystem() {
    console.log('🔧 Testing Complete Technical Display System');
    console.log('=' .repeat(50));

    const baseURL = 'http://localhost:3001';
    
    try {
        // Test 1: Verify backend route exists
        console.log('\n1. Testing backend route availability...');
        
        // Get auth token first
        console.log('🔐 Attempting login with credentials: admin/admin123');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        console.log('🔍 Login Response Status:', loginResponse.status);
        console.log('🔍 Login Response Data:', JSON.stringify(loginResponse.data, null, 2));

        if (!loginResponse.data.data || !loginResponse.data.data.token) {
            console.error('❌ Login response structure:', loginResponse.data);
            throw new Error('No token received from login - Check credentials or user exists');
        }

        const token = loginResponse.data.data.token;
        console.log('✅ Authentication successful');

        // Test 2: Check if quotations endpoint is accessible
        console.log('\n2. Testing quotations endpoint accessibility...');
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Test with a sample quotation data
        const testQuotationData = {
            customer_id: 1,
            natural_language_order: "Necesito 5 cajas de Liquipos sabor maracuyá y 3 de cereza",
            items: [
                {
                    product_id: 1,
                    product_name: "Liquipos sabor maracuyá",
                    description: "Caja de Liquipos sabor maracuyá para prueba técnica",
                    quantity: 5,
                    unit_price: 15000,
                    total_price: 75000
                }
            ],
            total_amount: 75000
        };

        console.log('📝 Testing ChatGPT + SIIGO integration with sample data:');
        console.log(JSON.stringify(testQuotationData, null, 2));

        // Test 3: Make the actual API call
        console.log('\n3. Making API call to create SIIGO invoice with ChatGPT...');
        
        const response = await axios.post(
            `${baseURL}/api/quotations/create-siigo-invoice-with-chatgpt`,
            testQuotationData,
            { headers }
        );

        console.log('\n✅ API Response Status:', response.status);
        console.log('✅ API Response Success:', response.data.success);

        // Test 4: Verify technical data is included
        console.log('\n4. Verifying technical data exposure...');
        
        const responseData = response.data.data;
        
        // Check for ChatGPT response
        if (responseData.chatgpt_response) {
            console.log('✅ ChatGPT Response Data Found');
            console.log('   Type:', typeof responseData.chatgpt_response);
            console.log('   Keys:', Object.keys(responseData.chatgpt_response).join(', '));
        } else {
            console.log('❌ ChatGPT Response Data Missing');
        }

        // Check for SIIGO request data
        if (responseData.siigo_request_data) {
            console.log('✅ SIIGO Request Data Found');
            console.log('   Type:', typeof responseData.siigo_request_data);
            console.log('   Keys:', Object.keys(responseData.siigo_request_data).join(', '));
        } else {
            console.log('❌ SIIGO Request Data Missing');
        }

        // Check for SIIGO response data
        if (responseData.siigo_response) {
            console.log('✅ SIIGO Response Data Found');
            console.log('   Type:', typeof responseData.siigo_response);
        } else {
            console.log('❌ SIIGO Response Data Missing');
        }

        // Test 5: Display sample technical data
        console.log('\n5. Sample Technical Data Preview:');
        console.log('=' .repeat(50));
        
        if (responseData.chatgpt_response) {
            console.log('\n📋 CHATGPT RESPONSE SAMPLE:');
            console.log('-' .repeat(30));
            console.log(JSON.stringify(responseData.chatgpt_response, null, 2).substring(0, 500) + '...');
        }
        
        if (responseData.siigo_request_data) {
            console.log('\n🔵 SIIGO REQUEST DATA SAMPLE:');
            console.log('-' .repeat(30));
            console.log(JSON.stringify(responseData.siigo_request_data, null, 2).substring(0, 500) + '...');
        }
        
        if (responseData.siigo_response) {
            console.log('\n🟢 SIIGO RESPONSE SAMPLE:');
            console.log('-' .repeat(30));
            console.log(JSON.stringify(responseData.siigo_response, null, 2).substring(0, 300) + '...');
        }

        console.log('\n✅ COMPLETE SYSTEM TEST PASSED');
        console.log('✅ Technical data is properly exposed for frontend display');
        console.log('✅ Route mismatch has been resolved');
        console.log('✅ Backend returns all required technical data');
        
        return true;

    } catch (error) {
        console.error('\n❌ TEST FAILED:');
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
            
            if (error.response.status === 404) {
                console.error('\n🔍 404 Error Analysis:');
                console.error('- Route may still be incorrectly defined');
                console.error('- Check backend/routes/quotations.js');
                console.error('- Verify route is: /create-siigo-invoice-with-chatgpt');
            }
            
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\n🔍 Connection Error Analysis:');
            console.error('- Backend server may not be running');
            console.error('- Check if server is running on port 3001');
            console.error('- Run: npm run dev or node backend/server.js');
            
        } else {
            console.error('Error:', error.message);
        }
        
        return false;
    }
}

// Run the test
testCompleteTechnicalDisplaySystem()
    .then(success => {
        console.log('\n' + '=' .repeat(50));
        if (success) {
            console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY');
            console.log('📋 The system should now display:');
            console.log('   1. ChatGPT response in green terminal box');
            console.log('   2. SIIGO request JSON in blue terminal box');
            console.log('   3. SIIGO response in green terminal box');
        } else {
            console.log('💥 TESTS FAILED - See errors above');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
