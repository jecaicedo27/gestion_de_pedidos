const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function findActiveProduct() {
    console.log('🔍 Finding Active SIIGO Product for Testing');
    console.log('==========================================');
    
    try {
        // Step 1: Login
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data?.token;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Step 2: Get all products
        const productsResponse = await axios.get(`${BASE_URL}/api/products?pageSize=100`, { headers });
        const products = productsResponse.data?.data || [];
        
        console.log(`📦 Total products found: ${products.length}`);
        
        // Step 3: Find products with real SIIGO codes (not PROD-xxx)
        const productsWithSiigoCodes = products.filter(p => {
            const hasRealSiigoCode = p.siigo_product_id && !p.siigo_product_id.startsWith('PROD-');
            const hasStock = p.available_quantity > 0;
            return hasRealSiigoCode && hasStock;
        });
        
        console.log(`✅ Products with real SIIGO codes and stock: ${productsWithSiigoCodes.length}`);
        
        // Step 4: Show the best candidates
        if (productsWithSiigoCodes.length > 0) {
            console.log('\n🎯 Best Candidates for Testing:');
            console.log('==============================');
            
            productsWithSiigoCodes.slice(0, 5).forEach((product, idx) => {
                console.log(`${idx + 1}. ${product.product_name}`);
                console.log(`   - SIIGO Code: ${product.siigo_product_id}`);
                console.log(`   - Internal Code: ${product.internal_code}`);
                console.log(`   - Barcode: ${product.barcode}`);
                console.log(`   - Stock: ${product.available_quantity}`);
                console.log(`   - Price: $${product.standard_price}`);
                console.log('   ---');
            });
            
            // Step 5: Test with the second product (first one was inactive)
            const testProduct = productsWithSiigoCodes[1]; // Try BORDEADOR DE COPAS (IMPLE01)
            
            // Get a customer
            const customersResponse = await axios.get(`${BASE_URL}/api/customers?search=`, { headers });
            const customers = customersResponse.data?.data?.customers || [];
            const testCustomer = customers[0];
            
            if (testCustomer) {
                console.log(`\n🧪 Testing invoice with: ${testProduct.product_name}`);
                console.log(`👤 Customer: ${testCustomer.name}`);
                
                const invoiceData = {
                    customer_id: testCustomer.id,
                    items: [{
                        code: testProduct.siigo_product_id, // Use the real SIIGO code
                        product_name: testProduct.product_name,
                        quantity: 1,
                        price: parseFloat(testProduct.standard_price) || 1000,
                        siigo_code: testProduct.siigo_product_id,
                        product_code: testProduct.internal_code || testProduct.siigo_product_id
                    }],
                    invoice_type: 'FV-1',
                    documentType: 'FV-1',
                    notes: `Test invoice with active SIIGO product - ${new Date().toLocaleString()}`
                };
                
                console.log('\n📋 Testing invoice creation...');
                const invoiceResponse = await axios.post(`${BASE_URL}/api/quotations/create-invoice`, invoiceData, { headers });
                
                console.log('🎉 SUCCESS! Invoice created successfully!');
                console.log('📊 Response:', JSON.stringify(invoiceResponse.data, null, 2));
            }
            
        } else {
            console.log('❌ No products with active SIIGO codes found');
            
            // Show some products without SIIGO codes as fallback
            console.log('\n📋 Products without SIIGO codes (will use fallback codes):');
            products.slice(0, 5).forEach((product, idx) => {
                console.log(`${idx + 1}. ${product.product_name}`);
                console.log(`   - Internal Code: ${product.internal_code}`);
                console.log(`   - Stock: ${product.available_quantity}`);
                console.log('   ---');
            });
        }

    } catch (error) {
        console.error('❌ Error finding active product:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error message:', error.message);
        }
    }
}

findActiveProduct();
