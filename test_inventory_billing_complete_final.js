const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testInventoryBillingComplete() {
    console.log('🔄 Testing Complete Inventory Billing System...');
    
    try {
        // 1. Test login first
        console.log('\n1. Testing login...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        if (!loginResponse.data.data || !loginResponse.data.data.token) {
            throw new Error('Login failed - no token received');
        }
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login successful, token received');
        
        // Set up axios with auth header
        const authAxios = axios.create({
            baseURL: API_BASE,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        // 2. Test products API (this is what inventory billing calls)
        console.log('\n2. Testing products API...');
        const productsResponse = await authAxios.get('/products?pageSize=1000');
        
        if (!productsResponse.data.success) {
            throw new Error('Products API returned failure');
        }
        
        const products = productsResponse.data.data || [];
        console.log(`✅ Products API working - ${products.length} products found`);
        
        if (products.length === 0) {
            console.log('⚠️ No products available for testing');
            return;
        }
        
        // Find a product for testing (relaxed requirements for testing)
        let activeProduct = products.find(p => 
            p.is_active && 
            p.stock > 0 && 
            (p.siigo_code || p.code)
        );
        
        // If no product with stock, just use the first active product
        if (!activeProduct) {
            activeProduct = products.find(p => p.is_active && (p.siigo_code || p.code));
        }
        
        // If still no product, use the first available product
        if (!activeProduct && products.length > 0) {
            activeProduct = products[0];
        }
        
        if (!activeProduct) {
            console.log('⚠️ No products available for testing');
            return;
        }
        
        console.log(`✅ Found test product: ${activeProduct.product_name || 'No name'} (ID: ${activeProduct.id}, Code: ${activeProduct.siigo_code || activeProduct.code || 'No code'})`);
        
        // 3. Test customers API (needed for customer dropdown)
        console.log('\n3. Testing customers API...');
        const customersResponse = await authAxios.get('/customers');
        
        if (!customersResponse.data.success) {
            throw new Error('Customers API returned failure');
        }
        
        // Extract customers from the correct nested structure
        const customersData = customersResponse.data.data?.customers || 
                            customersResponse.data?.customers || 
                            customersResponse.data.data || 
                            customersResponse.data || 
                            [];
        const customers = Array.isArray(customersData) ? customersData : [];
        console.log(`✅ Customers API working - ${customers.length} customers found`);
        
        if (customers.length === 0) {
            console.log('⚠️ No customers available for testing');
            console.log('Customer API response structure:', customersResponse.data);
            return;
        }
        
        // Find a customer with valid identification (relaxed requirements for testing)
        let testCustomer = customers.find(c => 
            c.identification_number && 
            c.commercial_name &&
            c.siigo_id
        );
        
        // If no customer with all requirements, just find one with identification
        if (!testCustomer) {
            testCustomer = customers.find(c => c.identification_number && c.commercial_name);
        }
        
        // If still no customer, use the first available
        if (!testCustomer && customers.length > 0) {
            testCustomer = customers[0];
        }
        
        if (!testCustomer) {
            console.log('⚠️ No customer with valid identification found');
            return;
        }
        
        console.log(`✅ Found test customer: ${testCustomer.commercial_name} (ID: ${testCustomer.identification_number})`);
        
        // 4. Test invoice creation (the critical part that was failing)
        console.log('\n4. Testing invoice creation...');
        
        const invoiceData = {
            customer_id: testCustomer.id,
            items: [{
                product_id: activeProduct.id,
                quantity: 1,
                unit_price: activeProduct.unit_price || 1000
            }]
        };
        
        console.log('Invoice data:', JSON.stringify(invoiceData, null, 2));
        
        try {
            const invoiceResponse = await authAxios.post('/quotations/create-invoice', invoiceData);
            
            if (invoiceResponse.data.success) {
                console.log('✅ INVOICE CREATION SUCCESSFUL!');
                console.log('Response:', invoiceResponse.data);
            } else {
                console.log('❌ Invoice creation returned failure:', invoiceResponse.data);
            }
        } catch (invoiceError) {
            console.log('❌ Invoice creation failed with error:');
            if (invoiceError.response) {
                console.log('Status:', invoiceError.response.status);
                console.log('Data:', invoiceError.response.data);
            } else {
                console.log('Error:', invoiceError.message);
            }
        }
        
        // 5. Test configuration endpoint
        console.log('\n5. Testing configuration endpoint...');
        try {
            const configResponse = await authAxios.get('/config');
            console.log('✅ Config endpoint working');
        } catch (configError) {
            console.log('❌ Config endpoint failed:', configError.message);
        }
        
        console.log('\n✅ INVENTORY BILLING SYSTEM TEST COMPLETED');
        console.log('📝 Summary:');
        console.log('- Login: ✅ Working');
        console.log('- Products API: ✅ Working');
        console.log('- Customers API: ✅ Working');
        console.log('- Invoice Creation: Check above result');
        console.log('- All API calls now use port 3001 (backend) instead of 3000 (frontend)');
        
    } catch (error) {
        console.error('❌ Critical error during test:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testInventoryBillingComplete();
