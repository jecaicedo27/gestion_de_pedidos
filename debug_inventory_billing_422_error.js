const axios = require('axios');

// Debug script for 422 error when creating invoice from inventory billing
async function debugInvoiceCreation422Error() {
    console.log('🔍 Debugging 422 error in invoice creation from inventory billing');
    
    const baseURL = 'http://localhost:3001';
    let authToken = null;
    
    try {
        // Step 1: Login to get authentication token
        console.log('\n1️⃣ Logging in to get authentication token...');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        authToken = loginResponse.data.token;
        console.log('✅ Login successful, token obtained');
        
        // Step 2: Get customer information (the one used in frontend)
        console.log('\n2️⃣ Getting customer information for JOHN EDISSON CAICEDO BENAVIDES...');
        const customerResponse = await axios.get(`${baseURL}/api/quotations/customers/search?q=JOHN EDISSON`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        console.log('Customer search result:', JSON.stringify(customerResponse.data, null, 2));
        
        if (customerResponse.data.length === 0) {
            console.log('❌ No customer found');
            return;
        }
        
        const customer = customerResponse.data[0];
        console.log('✅ Customer found:', customer.name);
        
        // Step 3: Get a sample product from inventory 
        console.log('\n3️⃣ Getting sample product from inventory...');
        const productsResponse = await axios.get(`${baseURL}/api/products?pageSize=10`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        console.log('Products available:', productsResponse.data.length);
        
        if (productsResponse.data.length === 0) {
            console.log('❌ No products found');
            return;
        }
        
        const sampleProduct = productsResponse.data[0];
        console.log('✅ Sample product:', sampleProduct.name, 'Price:', sampleProduct.price);
        
        // Step 4: Create invoice payload with CORRECT format expected by backend
        console.log('\n4️⃣ Creating invoice payload with backend expected format...');
        const invoicePayload = {
            customer_id: customer.id, // Backend expects customer_id, not customer object
            items: [{
                product_id: sampleProduct.id,
                product_name: sampleProduct.name,
                product_code: sampleProduct.code || `PROD-${sampleProduct.id}`,
                unit_price: sampleProduct.price,
                quantity: 1,
                total: sampleProduct.price
            }],
            total_amount: sampleProduct.price, // Backend expects total_amount, not total
            invoice_type: 'FV-1', // Backend expects invoice_type, not document_type
            payment_method: 'efectivo' // Backend expects lowercase
        };
        
        console.log('Invoice payload:', JSON.stringify(invoicePayload, null, 2));
        
        // Step 5: Try to create invoice and capture the 422 error details
        console.log('\n5️⃣ Attempting to create invoice...');
        try {
            const invoiceResponse = await axios.post(`${baseURL}/api/quotations/create-invoice-direct`, invoicePayload, {
                headers: { 
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Invoice created successfully:', invoiceResponse.data);
        } catch (invoiceError) {
            if (invoiceError.response && invoiceError.response.status === 422) {
                console.log('❌ 422 Validation Error Details:');
                console.log('Status:', invoiceError.response.status);
                console.log('Data:', JSON.stringify(invoiceError.response.data, null, 2));
                console.log('Headers:', invoiceError.response.headers);
                
                // Analyze validation errors
                if (invoiceError.response.data && invoiceError.response.data.errors) {
                    console.log('\n📋 Validation Error Analysis:');
                    Object.entries(invoiceError.response.data.errors).forEach(([field, messages]) => {
                        console.log(`  - ${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`);
                    });
                }
                
                if (invoiceError.response.data && invoiceError.response.data.message) {
                    console.log('\n📋 Error Message:', invoiceError.response.data.message);
                }
            } else {
                console.log('❌ Unexpected error:', invoiceError.message);
                if (invoiceError.response) {
                    console.log('Response status:', invoiceError.response.status);
                    console.log('Response data:', invoiceError.response.data);
                }
            }
        }
        
        // Step 6: Check if required fields are missing by examining controller
        console.log('\n6️⃣ Checking backend validation requirements...');
        
        // Try with different payload variations
        const alternativePayloads = [
            // Add seller_id
            {
                ...invoicePayload,
                seller_id: 388 // Common seller ID from SIIGO
            },
            // Add document_id
            {
                ...invoicePayload,
                document_id: 21992 // FV-1 document type
            },
            // Add both seller_id and document_id
            {
                ...invoicePayload,
                seller_id: 388,
                document_id: 21992
            },
            // Add cost_center
            {
                ...invoicePayload,
                seller_id: 388,
                document_id: 21992,
                cost_center: 235
            }
        ];
        
        for (let i = 0; i < alternativePayloads.length; i++) {
            console.log(`\n6.${i+1} Trying alternative payload ${i+1}...`);
            try {
                const altResponse = await axios.post(`${baseURL}/api/quotations/create-invoice-direct`, alternativePayloads[i], {
                    headers: { 
                        Authorization: `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log(`✅ Alternative payload ${i+1} worked!`);
                console.log('Successful payload:', JSON.stringify(alternativePayloads[i], null, 2));
                break;
            } catch (altError) {
                if (altError.response && altError.response.status === 422) {
                    console.log(`❌ Alternative ${i+1} failed with 422:`, altError.response.data.message || 'No message');
                } else {
                    console.log(`❌ Alternative ${i+1} failed:`, altError.message);
                }
            }
        }
        
    } catch (error) {
        console.log('❌ Script error:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the debug
debugInvoiceCreation422Error().then(() => {
    console.log('\n🏁 Debug completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
