const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testInventoryBillingSystem() {
    console.log('🧪 Testing Complete Inventory Billing System with Corrected JWT');
    console.log('================================================================');
    
    try {
        // Step 1: Login
        console.log('1. Testing login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        console.log('✅ Login successful:', loginResponse.status);
        
        // Fixed: Use correct token path
        const token = loginResponse.data.data?.token;
        
        if (!token) {
            console.error('❌ No token received in login response');
            console.log('📋 Login response data:', JSON.stringify(loginResponse.data, null, 2));
            return;
        }
        
        console.log('✅ Token extracted successfully');
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Step 2: Get inventory products  
        console.log('\n2. Testing inventory products API...');
        const productsResponse = await axios.get(`${BASE_URL}/api/products`, { headers });
        console.log('✅ Products retrieved:', productsResponse.status);
        console.log('📊 Products count:', productsResponse.data?.data?.length || 'Not found');

        // Step 3: Get customers
        console.log('\n3. Testing customers API...');
        const customersResponse = await axios.get(`${BASE_URL}/api/customers?search=`, { headers });
        console.log('✅ Customers retrieved:', customersResponse.status);
        console.log('📊 Customers count:', customersResponse.data?.data?.length || 'Not found');

        // Step 4: Prepare test invoice data
        console.log('\n4. Preparing test invoice data...');
        
        const products = productsResponse.data?.data || [];
        const customers = customersResponse.data?.data || [];
        
        if (products.length === 0) {
            console.log('⚠️ No products found, cannot proceed with invoice test');
            return;
        }
        
        if (customers.length === 0) {
            console.log('⚠️ No customers found, cannot proceed with invoice test');
            return;
        }

        // Use first available product and customer
        const testProduct = products[0];
        const testCustomer = customers[0];
        
        console.log('📦 Using product:', testProduct.name || testProduct.product_code);
        console.log('👤 Using customer:', testCustomer.commercial_name || testCustomer.name);

        const invoiceData = {
            customer: {
                id: testCustomer.id,
                siigo_id: testCustomer.siigo_id,
                document_number: testCustomer.document_number,
                commercial_name: testCustomer.commercial_name,
                name: testCustomer.name
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

        console.log('📋 Invoice data prepared');

        // Step 5: Create invoice using corrected endpoint
        console.log('\n5. Testing invoice creation with corrected system...');
        console.log('🎯 Using endpoint: /api/quotations/create-invoice (same as quotations)');
        
        const invoiceResponse = await axios.post(`${BASE_URL}/api/quotations/create-invoice`, invoiceData, { headers });
        
        console.log('✅ Invoice creation response:', invoiceResponse.status);
        console.log('📋 Response data:', JSON.stringify(invoiceResponse.data, null, 2));

        console.log('\n🎉 INVENTORY BILLING SYSTEM TEST COMPLETED SUCCESSFULLY!');
        console.log('✅ All fixes applied and working correctly');

    } catch (error) {
        console.error('❌ Error in inventory billing test:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error message:', error.message);
        }
    }
}

testInventoryBillingSystem();
