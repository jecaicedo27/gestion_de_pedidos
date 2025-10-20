const axios = require('axios');

async function debugSiigoInvoiceCreationError() {
    console.log('🔍 DEBUGGING ERROR 500 EN CREAR FACTURA SIIGO');
    console.log('================================================');
    
    try {
        // Test the endpoint that's failing
        const testData = {
            customerName: "JOHN EDISSON CAICEDO BENAVIDES",
            orderText: "5 sal limon de 250\n3 perlas de 360 fresa",
            paymentMethod: "transferencia"
        };
        
        console.log('📝 Testing with data:', testData);
        
        const response = await axios.post('http://localhost:3001/api/quotations/create-siigo-invoice-with-chatgpt', testData, {
            headers: {
                'Content-Type': 'application/json',
                // Adding a test authorization header - you might need to get a real token
                'Authorization': 'Bearer test-token'
            },
            timeout: 30000
        });
        
        console.log('✅ Response:', response.data);
        
    } catch (error) {
        console.log('❌ ERROR DETAILS:');
        console.log('Status:', error.response?.status);
        console.log('Status Text:', error.response?.statusText);
        console.log('Data:', error.response?.data);
        console.log('Headers:', error.response?.headers);
        console.log('Full Error:', error.message);
        
        if (error.response?.data) {
            console.log('📋 Detailed error response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugSiigoInvoiceCreationError().catch(console.error);
