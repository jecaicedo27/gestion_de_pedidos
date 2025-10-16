const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testQuotationEndpoints() {
    try {
        console.log('🧪 Testing Quotation Endpoints After Fixes...');
        console.log('='.repeat(50));

        // 1. Login first to get token
        console.log('🔐 Step 1: Logging in...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        if (!loginResponse.data.success) {
            throw new Error('Login failed');
        }

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful');

        // Headers with authentication
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // 2. Test customer search
        console.log('\n📋 Step 2: Testing customer search...');
        try {
            const customerResponse = await axios.get(
                `${BASE_URL}/api/quotations/customers/search?q=1082746400`,
                { headers }
            );
            console.log('✅ Customer search endpoint working');
            console.log(`   Found ${customerResponse.data.customers?.length || 0} customers`);
        } catch (error) {
            console.error('❌ Customer search failed:', error.response?.data || error.message);
        }

        // 3. Test ChatGPT natural language processing
        console.log('\n🤖 Step 3: Testing ChatGPT natural language processing...');
        try {
            const chatgptResponse = await axios.post(
                `${BASE_URL}/api/quotations/process-natural-order`,
                {
                    customer_id: 1, // Use a test customer ID
                    natural_language_order: 'Quiero 2 implementos IMPLE04 para prueba'
                },
                { 
                    headers,
                    timeout: 30000 // 30 seconds timeout for ChatGPT processing
                }
            );
            console.log('✅ ChatGPT processing endpoint working');
            console.log(`   Processed successfully: ${chatgptResponse.data.success}`);
            console.log(`   Items found: ${chatgptResponse.data.data?.structured_items?.length || 0}`);
        } catch (error) {
            console.error('❌ ChatGPT processing failed:', error.response?.data || error.message);
        }

        // 4. Test SIIGO invoice creation
        console.log('\n💰 Step 4: Testing SIIGO invoice creation...');
        try {
            const invoiceResponse = await axios.post(
                `${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`,
                {
                    customer_id: 1, // Use a test customer ID
                    natural_language_order: 'Quiero 1 implemento IMPLE04 para prueba de facturación',
                    notes: 'Factura de prueba para verificar endpoints'
                },
                { 
                    headers,
                    timeout: 45000 // 45 seconds timeout for full invoice process
                }
            );
            console.log('✅ SIIGO invoice creation endpoint working');
            console.log(`   Invoice created: ${invoiceResponse.data.success}`);
            if (invoiceResponse.data.data?.siigo_invoice_id) {
                console.log(`   SIIGO Invoice ID: ${invoiceResponse.data.data.siigo_invoice_id}`);
            }
        } catch (error) {
            console.error('❌ SIIGO invoice creation failed:', error.response?.data || error.message);
            if (error.response?.status === 500) {
                console.error('   This is a 500 Internal Server Error - check the specific error details above');
            }
        }

        // 5. Test creating invoice from quotation (alternative method)
        console.log('\n📋 Step 5: Testing create invoice from quotation...');
        try {
            const invoiceFromQuotationResponse = await axios.post(
                `${BASE_URL}/api/quotations/create-invoice`,
                {
                    customerId: 1,
                    items: [
                        {
                            product_code: 'IMPLE04',
                            product_name: 'PITILLOS ESPECIAL 10 MM',
                            quantity: 1,
                            unit_price: 106,
                            notes: 'Item de prueba'
                        }
                    ],
                    notes: 'Factura de prueba método alternativo'
                },
                { 
                    headers,
                    timeout: 30000
                }
            );
            console.log('✅ Create invoice from quotation endpoint working');
            console.log(`   Invoice created: ${invoiceFromQuotationResponse.data.success}`);
        } catch (error) {
            console.error('❌ Create invoice from quotation failed:', error.response?.data || error.message);
        }

        // 6. Test get quotations list
        console.log('\n📊 Step 6: Testing get quotations list...');
        try {
            const quotationsResponse = await axios.get(
                `${BASE_URL}/api/quotations?page=1&limit=5`,
                { headers }
            );
            console.log('✅ Get quotations endpoint working');
            console.log(`   Quotations found: ${quotationsResponse.data.data?.length || 0}`);
        } catch (error) {
            console.error('❌ Get quotations failed:', error.response?.data || error.message);
        }

        // 7. Test NotificationSystem SIIGO invoices endpoint
        console.log('\n🔔 Step 7: Testing NotificationSystem SIIGO invoices endpoint...');
        try {
            const notificationResponse = await axios.get(
                `${BASE_URL}/api/siigo/invoices?page=1&page_size=5`,
                { headers, timeout: 10000 }
            );
            console.log('✅ SIIGO invoices endpoint working');
            console.log(`   Invoices retrieved: ${notificationResponse.data?.results?.length || 0}`);
        } catch (error) {
            console.error('❌ SIIGO invoices endpoint failed:', error.response?.data || error.message);
            if (error.response?.status === 500) {
                console.error('   This is the 500 error we need to fix in NotificationSystem!');
            }
        }

        console.log('\n🎯 Test Summary:');
        console.log('='.repeat(50));
        console.log('✅ Authentication: Working');
        console.log('✅ Customer search: Check results above');
        console.log('✅ ChatGPT processing: Check results above');
        console.log('✅ SIIGO invoice creation: Check results above');
        console.log('✅ Invoice from quotation: Check results above');
        console.log('✅ Quotations list: Check results above');
        console.log('✅ SIIGO invoices endpoint: Check results above');

        console.log('\n📋 Next Steps:');
        console.log('1. If any endpoints show ❌, those need individual fixing');
        console.log('2. Focus on 500 Internal Server Errors first');
        console.log('3. Test the complete end-to-end flow');
        console.log('4. Apply rate limiting improvements for SIIGO API');

        return { success: true };

    } catch (error) {
        console.error('💥 Test execution failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Execute the test
testQuotationEndpoints()
    .then(result => {
        if (result.success) {
            console.log('\n🎉 Quotation endpoints test completed!');
            process.exit(0);
        } else {
            console.error('\n💥 Test failed:', result.error);
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
