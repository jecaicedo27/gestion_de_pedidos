const fetch = require('node-fetch');

const debugInventoryAPIResponse = async () => {
    try {
        console.log('🔍 Debugging Frontend Inventory API Response...\n');

        // Test the same endpoint the frontend calls
        const response = await fetch('http://localhost:3001/api/products?pageSize=1000', {
            headers: {
                'Content-Type': 'application/json'
                // Note: Testing without auth first to see basic response
            }
        });

        console.log(`📊 Response Status: ${response.status}`);
        
        if (response.status !== 200) {
            console.log('❌ Non-200 status response');
            const text = await response.text();
            console.log('Response:', text);
            return;
        }

        const data = await response.json();
        console.log(`✅ API Response Success: ${data.success}`);
        console.log(`📦 Total Products Returned: ${data.data?.length || 0}\n`);

        if (data.data && data.data.length > 0) {
            console.log('🔍 Sample Products Analysis:');
            
            // Check first 5 products for stock values
            const sampleProducts = data.data.slice(0, 10);
            
            sampleProducts.forEach((product, index) => {
                console.log(`\n--- Product ${index + 1} ---`);
                console.log(`Name: ${product.product_name}`);
                console.log(`Category: ${product.category}`);
                console.log(`Available Quantity: ${product.available_quantity}`);
                console.log(`Stock Field: ${product.stock}`);
                console.log(`Standard Price: ${product.standard_price}`);
                
                // Calculate stock using same logic as frontend
                const calculatedStock = product.available_quantity || product.stock || 0;
                console.log(`🔢 Calculated Stock (Frontend Logic): ${calculatedStock}`);
                
                if (calculatedStock === 0) {
                    console.log('⚠️  This product would show ZERO stock in frontend!');
                }
            });

            // Check specifically for LIQUIPOP products
            console.log('\n🍭 LIQUIPOP Products Check:');
            const liquipopProducts = data.data.filter(p => 
                p.product_name && p.product_name.toUpperCase().includes('LIQUIPOP')
            );
            
            console.log(`Found ${liquipopProducts.length} LIQUIPOP products`);
            
            liquipopProducts.slice(0, 5).forEach(product => {
                const stock = product.available_quantity || product.stock || 0;
                console.log(`${product.product_name}: ${stock} units`);
            });

            // Check data structure
            console.log('\n📋 Product Object Structure Sample:');
            if (data.data[0]) {
                console.log('Available Fields:', Object.keys(data.data[0]));
            }
        }

    } catch (error) {
        console.error('❌ Error testing API:', error.message);
    }
};

debugInventoryAPIResponse();
