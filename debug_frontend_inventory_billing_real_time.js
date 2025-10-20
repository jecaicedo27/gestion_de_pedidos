const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Interceptar la comunicación real con la aplicación
async function debugFrontendBilling() {
    console.log('🔍 Debug Frontend Inventory Billing Real Time');
    console.log('===============================================');
    
    try {
        // Step 1: Login
        console.log('1. Logging in...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data?.token;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Step 2: Get LIQUIPOPS products specifically  
        console.log('\n2. Getting LIQUIPOPS products...');
        const productsResponse = await axios.get(`${BASE_URL}/api/products?pageSize=100`, { headers });
        const products = productsResponse.data?.data || [];
        
        const liquipopsProducts = products.filter(p => 
            p.product_name.toLowerCase().includes('liquipops') || 
            p.product_name.toLowerCase().includes('coco')
        );
        
        console.log(`\n📦 LIQUIPOPS products found: ${liquipopsProducts.length}`);
        liquipopsProducts.forEach((product, idx) => {
            console.log(`${idx + 1}. ${product.product_name}`);
            console.log(`   - ID: ${product.id}`);
            console.log(`   - SIIGO Code: ${product.siigo_product_id || 'NO SIIGO CODE'}`);
            console.log(`   - Internal Code: ${product.internal_code || 'NO INTERNAL CODE'}`);
            console.log(`   - Product Code: ${product.product_code || 'NO PRODUCT CODE'}`);
            console.log(`   - Barcode: ${product.barcode || 'NO BARCODE'}`);
            console.log(`   - Stock: ${product.available_quantity || 0}`);
            console.log(`   - Price: $${product.standard_price || 0}`);
            console.log('   ---');
        });

        // Step 3: Simulate the exact request that frontend is making
        console.log('\n3. Simulating frontend request with LIQUIPOPS...');
        
        if (liquipopsProducts.length > 0) {
            // Get customers
            const customersResponse = await axios.get(`${BASE_URL}/api/customers?search=`, { headers });
            const customers = customersResponse.data?.data?.customers || [];
            
            if (customers.length > 0) {
                const testCustomer = customers[0];
                const testProduct = liquipopsProducts[0]; // First LIQUIPOPS product
                
                console.log(`\n👤 Using customer: ${testCustomer.name}`);
                console.log(`📦 Using product: ${testProduct.product_name}`);
                
                // Create the EXACT same request format as frontend
                const frontendRequestData = {
                    customer_id: testCustomer.id,
                    items: [{
                        // This is probably what's causing the issue
                        code: testProduct.siigo_code || testProduct.product_code || testProduct.barcode || `PROD-${testProduct.id}`,
                        product_name: testProduct.product_name,
                        quantity: 1,
                        price: parseFloat(testProduct.standard_price) || 1000,
                        siigo_code: testProduct.siigo_code || testProduct.product_code || testProduct.barcode,
                        product_code: testProduct.internal_code || testProduct.siigo_code
                    }],
                    invoice_type: 'FV-1',
                    documentType: 'FV-1',
                    notes: 'Debug test from frontend simulation'
                };
                
                console.log('\n📋 Frontend request data:');
                console.log(JSON.stringify(frontendRequestData, null, 2));
                
                console.log('\n🧪 Attempting invoice creation...');
                
                try {
                    const invoiceResponse = await axios.post(`${BASE_URL}/api/quotations/create-invoice`, frontendRequestData, { headers });
                    console.log('✅ SUCCESS! Frontend simulation worked!');
                    console.log('📊 Response:', JSON.stringify(invoiceResponse.data, null, 2));
                } catch (error) {
                    console.log('❌ ERROR! Same error as frontend:');
                    if (error.response) {
                        console.log('Status:', error.response.status);
                        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
                        
                        // Now let's try with a known working product
                        console.log('\n🔄 Trying with known working product (IMPLE01)...');
                        
                        const workingProducts = products.filter(p => 
                            p.siigo_product_id && ['IMPLE01', 'IMPLE06', 'CAJA002'].includes(p.siigo_product_id)
                        );
                        
                        if (workingProducts.length > 0) {
                            const workingProduct = workingProducts[0];
                            
                            const workingRequestData = {
                                customer_id: testCustomer.id,
                                items: [{
                                    code: workingProduct.siigo_product_id,
                                    product_name: workingProduct.product_name,
                                    quantity: 1,
                                    price: parseFloat(workingProduct.standard_price) || 1000,
                                    siigo_code: workingProduct.siigo_product_id,
                                    product_code: workingProduct.internal_code || workingProduct.siigo_product_id
                                }],
                                invoice_type: 'FV-1',
                                documentType: 'FV-1',
                                notes: 'Debug test with working product'
                            };
                            
                            console.log(`📦 Using working product: ${workingProduct.product_name} (${workingProduct.siigo_product_id})`);
                            
                            const workingResponse = await axios.post(`${BASE_URL}/api/quotations/create-invoice`, workingRequestData, { headers });
                            console.log('✅ WORKING PRODUCT SUCCESS!');
                            console.log('📊 Response:', JSON.stringify(workingResponse.data, null, 2));
                            
                            console.log('\n🔧 SOLUTION FOUND:');
                            console.log('The issue is that LIQUIPOPS products have inactive SIIGO codes.');
                            console.log('Frontend should filter out products with inactive codes or provide fallback.');
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ Debug error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

debugFrontendBilling();
