const axios = require('axios');

async function testCategoriesAndProductsAPI() {
    const baseURL = 'http://localhost:3001';
    
    // You'll need a real JWT token from logging into your application
    // For now, let's test without authentication first
    
    console.log('🔍 Probando APIs de categorías y productos...\n');
    
    try {
        // Test categories endpoint
        console.log('📂 CATEGORÍAS:');
        console.log('==============');
        
        try {
            const categoriesResponse = await axios.get(`${baseURL}/api/categories`);
            console.log(`✅ Total categorías: ${categoriesResponse.data.length}`);
            categoriesResponse.data.forEach(cat => {
                console.log(`• ${cat.name} (ID: ${cat.id})`);
            });
        } catch (error) {
            console.log(`❌ Error categorías: ${error.message}`);
        }

        console.log('\n📦 PRODUCTOS:');
        console.log('==============');
        
        try {
            const productsResponse = await axios.get(`${baseURL}/api/products`);
            console.log(`✅ Total productos: ${productsResponse.data.length}`);
            
            if (productsResponse.data.length > 0) {
                console.log('\n🎯 Primeros 10 productos:');
                productsResponse.data.slice(0, 10).forEach(product => {
                    console.log(`• ${product.siigo_product_id || product.internal_code} | ${product.product_name} | ${product.category}`);
                });
                
                // Look for LIQUIPG05 specifically
                const liquipg05 = productsResponse.data.find(p => 
                    p.siigo_product_id === 'LIQUIPG05' || p.internal_code === 'LIQUIPG05'
                );
                
                if (liquipg05) {
                    console.log('\n🎉 LIQUIPG05 encontrado en API:');
                    console.log(`   Nombre: ${liquipg05.product_name}`);
                    console.log(`   Categoría: ${liquipg05.category}`);
                    console.log(`   Precio: $${liquipg05.standard_price}`);
                    console.log(`   Barcode: ${liquipg05.barcode}`);
                    console.log(`   Stock: ${liquipg05.stock}`);
                }
            }
        } catch (error) {
            console.log(`❌ Error productos: ${error.message}`);
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
            }
        }

        console.log('\n🔍 CATEGORÍAS POR PRODUCTOS:');
        console.log('============================');
        
        try {
            const productsResponse = await axios.get(`${baseURL}/api/products`);
            const categoryCounts = {};
            
            productsResponse.data.forEach(product => {
                const category = product.category || 'Sin categoría';
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            });
            
            Object.entries(categoryCounts).forEach(([category, count]) => {
                console.log(`• ${category}: ${count} productos`);
            });
        } catch (error) {
            console.log(`❌ Error contando productos por categoría: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

testCategoriesAndProductsAPI();
