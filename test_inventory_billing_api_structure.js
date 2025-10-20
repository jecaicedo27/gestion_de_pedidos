const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testInventoryBillingAPIs() {
    console.log('🔍 Testing API Response Structures for Inventory Billing');
    console.log('=========================================================');
    
    try {
        // Step 1: Login
        console.log('1. Testing login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        console.log('✅ Login successful:', loginResponse.status);
        
        const token = loginResponse.data.data?.token;
        
        if (!token) {
            console.error('❌ No token received');
            return;
        }
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Step 2: Inspect products API response
        console.log('\n2. Inspecting products API response...');
        const productsResponse = await axios.get(`${BASE_URL}/api/products`, { headers });
        console.log('✅ Products API status:', productsResponse.status);
        console.log('📋 Full products response structure:');
        console.log(JSON.stringify(productsResponse.data, null, 2));

        // Step 3: Inspect customers API response  
        console.log('\n3. Inspecting customers API response...');
        const customersResponse = await axios.get(`${BASE_URL}/api/customers?search=`, { headers });
        console.log('✅ Customers API status:', customersResponse.status);
        console.log('📋 Full customers response structure:');
        console.log(JSON.stringify(customersResponse.data, null, 2));

        // Step 4: Test with actual data if available
        console.log('\n4. Testing with actual data...');
        
        const products = productsResponse.data?.data || productsResponse.data?.products || productsResponse.data || [];
        const customers = customersResponse.data?.data || customersResponse.data?.customers || customersResponse.data || [];
        
        console.log('📦 Products array length:', products.length);
        console.log('👤 Customers array length:', customers.length);
        
        if (products.length > 0) {
            console.log('📦 First product structure:', JSON.stringify(products[0], null, 2));
        }
        
        if (customers.length > 0) {
            console.log('👤 First customer structure:', JSON.stringify(customers[0], null, 2));
        }

        // Step 5: Test invoice creation if data is available
        if (products.length > 0 && customers.length > 0) {
            console.log('\n5. Testing invoice creation with available data...');
            
            const testProduct = products[0];
            const testCustomer = customers[0];
            
            const invoiceData = {
                customer: {
                    id: testCustomer.id,
                    siigo_id: testCustomer.siigo_id,
                    document_number: testCustomer.document_number,
                    commercial_name: testCustomer.commercial_name || testCustomer.name,
                    name: testCustomer.name || testCustomer.commercial_name
                },
                items: [{
                    id: testProduct.id,
                    product_code: testProduct.product_code,
                    siigo_code: testProduct.siigo_code,
                    barcode: testProduct.barcode,
                    name: testProduct.name,
                    quantity: 1,
                    price: parseFloat(testProduct.price) || 1000,
                    total: parseFloat(testProduct.price) || 1000
                }],
                subtotal: parseFloat(testProduct.price) || 1000,
                total: parseFloat(testProduct.price) || 1000,
                documentType: 'FV-1'
            };

            console.log('📋 Test invoice data prepared:', JSON.stringify(invoiceData, null, 2));

            const invoiceResponse = await axios.post(`${BASE_URL}/api/quotations/create-invoice`, invoiceData, { headers });
            console.log('✅ Invoice creation response:', invoiceResponse.status);
            console.log('📋 Invoice response:', JSON.stringify(invoiceResponse.data, null, 2));
        }

    } catch (error) {
        console.error('❌ Error in API structure test:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error message:', error.message);
        }
    }
}

testInventoryBillingAPIs();
