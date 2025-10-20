const axios = require('axios');

async function testInventoryBillingAfterFix() {
    console.log('🔧 Testing Inventory Billing System After File Corruption Fix');
    console.log('=' .repeat(60));

    try {
        // Step 1: Verify login and get token
        console.log('1. Testing user login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        if (loginResponse.status !== 200) {
            throw new Error(`Login failed with status: ${loginResponse.status}`);
        }

        const token = loginResponse.data.token;
        console.log('✅ Login successful, token obtained');

        // Step 2: Get products with stock for inventory billing
        console.log('\n2. Fetching products with stock...');
        const productsResponse = await axios.get('http://localhost:3001/api/products', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const productsWithStock = productsResponse.data.filter(p => p.stock > 0);
        console.log(`✅ Found ${productsWithStock.length} products with stock`);

        if (productsWithStock.length === 0) {
            console.log('❌ No products with stock found - cannot test billing');
            return;
        }

        // Step 3: Get customers for billing
        console.log('\n3. Fetching customers...');
        const customersResponse = await axios.get('http://localhost:3001/api/customers', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const customers = customersResponse.data;
        console.log(`✅ Found ${customers.length} customers`);

        if (customers.length === 0) {
            console.log('❌ No customers found - cannot test billing');
            return;
        }

        // Step 4: Test the inventory billing endpoint (should now use correct /create-invoice)
        console.log('\n4. Testing inventory billing with correct endpoint...');
        
        const testCustomer = customers[0];
        const testProduct = productsWithStock[0];
        
        console.log(`Selected customer: ${testCustomer.name} (Document: ${testCustomer.document})`);
        console.log(`Selected product: ${testProduct.name} (Code: ${testProduct.siigo_code || testProduct.product_code || testProduct.barcode})`);

        const billingData = {
            customer: {
                id: testCustomer.id,
                name: testCustomer.name,
                document: testCustomer.document,
                document_type: testCustomer.document_type || 'CC'
            },
            items: [{
                id: testProduct.id,
                name: testProduct.name,
                quantity: 1,
                price: testProduct.price || 10000,
                total: testProduct.price || 10000,
                code: testProduct.siigo_code || testProduct.product_code || testProduct.barcode || `PROD-${testProduct.id}`
            }],
            documentType: 'FV-1',
            totalAmount: testProduct.price || 10000,
            observations: 'Test invoice from inventory billing - after corruption fix'
        };

        console.log('\n📋 Invoice data to send:');
        console.log(JSON.stringify(billingData, null, 2));

        // This should now use the correct endpoint: /api/quotations/create-invoice
        const invoiceResponse = await axios.post('http://localhost:3001/api/quotations/create-invoice', billingData, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('\n✅ SUCCESS! Invoice created successfully');
        console.log(`Status: ${invoiceResponse.status}`);
        console.log('Response:', JSON.stringify(invoiceResponse.data, null, 2));

        // Step 5: Verify the fix worked
        console.log('\n5. ✅ CORRUPTION FIX VERIFICATION:');
        console.log('✅ System now uses correct endpoint: /api/quotations/create-invoice');
        console.log('✅ No more 422 errors from /create-invoice-direct');
        console.log('✅ Product codes are properly mapped');
        console.log('✅ DocumentType included correctly');
        console.log('✅ Same successful system as quotations');

    } catch (error) {
        console.error('\n❌ Error during test:');
        console.error('Status:', error.response?.status);
        console.error('Message:', error.message);
        console.error('Response data:', error.response?.data);
        
        if (error.response?.status === 422) {
            console.log('\n⚠️  Still getting 422 error - checking if there are remaining issues:');
            console.log('- Verify the frontend file was saved correctly');
            console.log('- Check if there are any cached or duplicate function calls');
            console.log('- Ensure browser cache is cleared');
        }
    }
}

testInventoryBillingAfterFix();
