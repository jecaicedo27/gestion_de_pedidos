const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testChatGPTProcessing() {
    console.log('🧪 Testing ChatGPT Processing with Correct Authentication');
    console.log('====================================================\n');

    try {
        // 1. Authenticate
        console.log('1. 🔐 Authenticating...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        if (!token) {
            throw new Error('No token received from login');
        }
        console.log('✅ Authentication successful');
        console.log(`   Token: ${token.substring(0, 50)}...`);

        // Configure axios with the token for all subsequent requests
        const authAxios = axios.create({
            baseURL: API_URL,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // 2. Search for customer
        console.log('\n2. 🔍 Searching for customer...');
        const customerResponse = await authAxios.get('/quotations/customers/search', {
            params: { q: '1082746400' }
        });

        if (customerResponse.data.length > 0) {
            console.log('✅ Customer found:', customerResponse.data[0]);
            const customerId = customerResponse.data[0].id;

            // 3. Process with ChatGPT
            console.log('\n3. 🤖 Processing with ChatGPT...');
            const orderText = "Necesito 3 cajas de liquipops de cereza y 2 de fresa";
            
            const chatgptResponse = await authAxios.post('/quotations/natural-language', {
                message: orderText,
                customerId: customerId
            });

            console.log('✅ ChatGPT Response:', JSON.stringify(chatgptResponse.data, null, 2));

            // 4. Create quotation
            if (chatgptResponse.data.success) {
                console.log('\n4. 📝 Creating quotation...');
                const quotationResponse = await authAxios.post('/quotations', {
                    customer_id: customerId,
                    products: chatgptResponse.data.products || [],
                    payment_method: 'efectivo',
                    delivery_method: 'domicilio',
                    notes: `Pedido procesado por ChatGPT: ${orderText}`
                });

                console.log('✅ Quotation created:', quotationResponse.data);

                // 5. Create invoice
                if (quotationResponse.data.id) {
                    console.log('\n5. 🧾 Creating invoice from quotation...');
                    const invoiceResponse = await authAxios.post(`/quotations/${quotationResponse.data.id}/invoice`);
                    console.log('✅ Invoice created:', invoiceResponse.data);
                }
            }
        } else {
            console.log('⚠️ No customer found with identification 1082746400');
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            console.error('   Authentication issue detected');
        }
        if (error.response?.status === 500) {
            console.error('   Server error - check backend logs');
        }
    }
}

// Run the test
testChatGPTProcessing();
