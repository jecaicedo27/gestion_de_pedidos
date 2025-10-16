const axios = require('axios');

async function testChatGPTEndpoint() {
    console.log('🧪 Testing Fixed ChatGPT Integration Endpoint...\n');

    try {
        // Test data matching the interface expectations
        const testData = {
            customer_id: 1, // Assume customer with ID 1 exists
            notes: "Pedido de prueba para ChatGPT",
            items: [
                {
                    product_code: "LIQUIPP01",
                    product_name: "Liquipops Maracuyá",
                    quantity: 5,
                    unit_price: 2500,
                    confidence_score: 0.95
                }
            ],
            chatgpt_processing_id: null,
            natural_language_order: "Necesito 5 cajas de Liquipops sabor maracuyá"
        };

        // Test 1: Check if correct endpoint exists
        console.log('📍 Testing correct endpoint: POST /api/quotations/create-siigo-invoice-with-chatgpt');
        
        const response = await axios.post('http://localhost:3001/api/quotations/create-siigo-invoice-with-chatgpt', testData, {
            headers: {
                'Content-Type': 'application/json',
                // Note: We'll need a valid token for actual testing
                'Authorization': 'Bearer test-token'
            },
            timeout: 30000,
            validateStatus: function (status) {
                // Accept any status for testing - we want to see what happens
                return status < 500; // Don't throw error for 4xx
            }
        });

        console.log('\n✅ Response received:');
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        
        if (response.data) {
            console.log('\n📋 Response Data:');
            console.log(JSON.stringify(response.data, null, 2));
        }

        // Test 2: Check if old wrong endpoint returns 404
        console.log('\n📍 Testing old wrong endpoint should return 404: POST /api/quotations/create-siigo-with-chatgpt');
        
        try {
            const wrongResponse = await axios.post('http://localhost:3001/api/quotations/create-siigo-with-chatgpt', testData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                },
                timeout: 10000,
                validateStatus: function (status) {
                    return status < 500;
                }
            });
            
            console.log('❌ Wrong endpoint unexpectedly responded with:', wrongResponse.status);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('✅ Correctly returns 404 for wrong endpoint');
            } else {
                console.log('⚠️  Wrong endpoint error:', error.code || error.message);
            }
        }

    } catch (error) {
        console.error('\n❌ Error testing endpoints:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Status Text:', error.response.statusText);
            console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.log('No response received. Server might be down.');
            console.log('Request error:', error.code || error.message);
        } else {
            console.log('Error:', error.message);
        }
    }

    console.log('\n🔍 Next Steps:');
    console.log('1. Make sure backend is running on port 3001');
    console.log('2. Test with valid authentication token');
    console.log('3. Test frontend integration with browser');
    console.log('4. Verify ChatGPT response display in UI');
}

// Run the test
testChatGPTEndpoint().catch(console.error);
