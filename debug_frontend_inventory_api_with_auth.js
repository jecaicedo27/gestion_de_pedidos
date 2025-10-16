const fetch = require('node-fetch');

const debugInventoryAPIWithAuth = async () => {
    try {
        console.log('🔍 Debugging Frontend Inventory API Response WITH AUTH...\n');

        // First, let's try to login and get a token
        const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',  // Using default admin credentials
                password: 'admin123'   // Using longer password (6+ chars required)
            })
        });

        if (loginResponse.status !== 200) {
            console.log('❌ Failed to login');
            const loginText = await loginResponse.text();
            console.log('Login response:', loginText);
            return;
        }

        const loginData = await loginResponse.json();
        
        if (!loginData.success || !loginData.data?.token) {
            console.log('❌ Login failed - no token received');
            console.log('Login data:', loginData);
            return;
        }

        const token = loginData.data.token;
        console.log('✅ Login successful, got token\n');

        // Now test the products endpoint with authentication
        const response = await fetch('http://localhost:3001/api/products?pageSize=1000', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`📊 Products API Response Status: ${response.status}`);
        
        if (response.status !== 200) {
            console.log('❌ Non-200 status response from products API');
            const text = await response.text();
            console.log('Response:', text);
            return;
        }

        const data = await response.json();
        console.log(`✅ Products API Response Success: ${data.success}`);
        console.log(`📦 Total Products Returned: ${data.data?.length || 0}\n`);

        if (data.data && data.data.length > 0) {
            console.log('🔍 Sample Products Analysis:');
            
            // Check first 10 products for stock values
            const sampleProducts = data.data.slice(0, 10);
            
            sampleProducts.forEach((product, index) => {
                console.log(`\n--- Product ${index + 1} ---`);
                console.log(`Name: ${product.product_name}`);
                console.log(`Category: ${product.category || 'undefined'}`);
                console.log(`Available Quantity: ${product.available_quantity}`);
                console.log(`Stock Field: ${product.stock}`);
                console.log(`Standard Price: ${product.standard_price}`);
                
                // Calculate stock using same logic as frontend
                const calculatedStock = product.available_quantity || product.stock || 0;
                console.log(`🔢 Calculated Stock (Frontend Logic): ${calculatedStock}`);
                
                if (calculatedStock === 0) {
                    console.log('⚠️  This product would show ZERO stock in frontend!');
                } else {
                    console.log('✅ This product would show stock in frontend');
                }
            });

            // Check specifically for LIQUIPOP products
            console.log('\n🍭 LIQUIPOP Products Analysis:');
            const liquipopProducts = data.data.filter(p => 
                p.product_name && p.product_name.toUpperCase().includes('LIQUIPOP')
            );
            
            console.log(`Found ${liquipopProducts.length} LIQUIPOP products`);
            
            if (liquipopProducts.length > 0) {
                liquipopProducts.slice(0, 8).forEach((product, index) => {
                    const stock = product.available_quantity || product.stock || 0;
                    console.log(`${index + 1}. ${product.product_name}: ${stock} units (available_quantity: ${product.available_quantity}, stock: ${product.stock})`);
                });
            }

            // Check data structure
            console.log('\n📋 Product Object Structure Sample:');
            if (data.data[0]) {
                console.log('Available Fields:', Object.keys(data.data[0]).sort());
            }

            // Count products with zero stock
            const zeroStockProducts = data.data.filter(p => {
                const calculatedStock = p.available_quantity || p.stock || 0;
                return calculatedStock === 0;
            });

            console.log(`\n📊 Stock Summary:`);
            console.log(`Total Products: ${data.data.length}`);
            console.log(`Products with ZERO stock: ${zeroStockProducts.length}`);
            console.log(`Products with stock: ${data.data.length - zeroStockProducts.length}`);

            if (zeroStockProducts.length === data.data.length) {
                console.log('\n❌ ALL PRODUCTS HAVE ZERO STOCK - This explains the frontend issue!');
            }

        }

    } catch (error) {
        console.error('❌ Error testing API:', error.message);
    }
};

debugInventoryAPIWithAuth();
