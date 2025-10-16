const axios = require('axios');

async function verifyProductsWithStock() {
    console.log('🔍 VERIFICANDO DISPLAY DE STOCK EN PRODUCTOS');
    console.log('=============================================');
    
    try {
        // 1. Login para obtener token
        console.log('1️⃣ Haciendo login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login exitoso');

        // 2. Obtener productos con información de stock
        console.log('\n2️⃣ Obteniendo productos con stock...');
        const productsResponse = await axios.get('http://localhost:3001/api/products?page=1&pageSize=10', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (productsResponse.data.success) {
            const products = productsResponse.data.data;
            console.log(`📦 ${products.length} productos obtenidos`);
            
            console.log('\n3️⃣ Información de stock por producto:');
            console.log('======================================');
            
            products.forEach((product, index) => {
                console.log(`\n${index + 1}. ${product.product_name || product.name}`);
                console.log(`   Código: ${product.barcode}`);
                console.log(`   Stock Total: ${product.stock !== null && product.stock !== undefined ? product.stock : 'N/A'}`);
                console.log(`   Stock Disponible: ${product.available_quantity !== null && product.available_quantity !== undefined ? product.available_quantity : 'N/A'}`);
                console.log(`   Categoría: ${product.category}`);
                
                // Simular la lógica del frontend
                let displayText;
                if (product.available_quantity !== null && product.available_quantity !== undefined) {
                    displayText = `${product.available_quantity} unidades (${product.available_quantity > 0 ? 'VERDE' : 'ROJO'})`;
                } else {
                    displayText = 'No disponible (GRIS)';
                }
                console.log(`   💡 Frontend mostraría: ${displayText}`);
            });

            // 4. Estadísticas de stock
            console.log('\n4️⃣ Estadísticas de stock:');
            console.log('========================');
            
            const withStock = products.filter(p => p.available_quantity > 0);
            const withoutStock = products.filter(p => p.available_quantity === 0);
            const noData = products.filter(p => p.available_quantity === null || p.available_quantity === undefined);
            
            console.log(`📈 Con stock disponible: ${withStock.length}`);
            console.log(`📉 Sin stock: ${withoutStock.length}`);
            console.log(`❓ Sin datos de stock: ${noData.length}`);
            
            if (withStock.length > 0) {
                console.log('\n🟢 Productos con stock:');
                withStock.slice(0, 3).forEach(p => {
                    console.log(`   - ${p.product_name}: ${p.available_quantity} unidades`);
                });
            }

        } else {
            console.error('❌ Error al obtener productos:', productsResponse.data.message);
        }

        console.log('\n✅ Verificación completada. El frontend ahora debe mostrar la columna "Stock Disponible"');

    } catch (error) {
        console.error('❌ Error en la verificación:', error.message);
        if (error.response) {
            console.error('📄 Respuesta del servidor:', error.response.data);
        }
    }
}

verifyProductsWithStock();
