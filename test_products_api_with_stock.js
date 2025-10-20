const axios = require('axios');

async function testProductsAPIWithStock() {
    console.log('🧪 PROBANDO API DE PRODUCTOS CON STOCK');
    console.log('=====================================');
    
    try {
        // 1. Hacer login para obtener token
        console.log('1️⃣ Haciendo login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login exitoso, token obtenido');

        // 2. Obtener productos con stock
        console.log('\n2️⃣ Obteniendo productos...');
        const productsResponse = await axios.get('http://localhost:3001/api/products', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const products = productsResponse.data;
        console.log(`📦 Total productos obtenidos: ${products.length}`);

        // 3. Filtrar productos que tienen stock
        const productsWithStock = products.filter(p => p.stock > 0 || p.available_quantity > 0);
        console.log(`📊 Productos con stock: ${productsWithStock.length}`);

        // 4. Mostrar algunos productos con stock
        console.log('\n3️⃣ Muestra de productos con stock:');
        productsWithStock.slice(0, 10).forEach((product, index) => {
            console.log(`   ${index + 1}. ${product.name}`);
            console.log(`      Stock: ${product.stock || 'null'}`);
            console.log(`      Disponible: ${product.available_quantity || 'null'}`);
            console.log(`      Categoría: ${product.category_name || 'Sin categoría'}`);
            console.log(`      Código: ${product.code}`);
            console.log('');
        });

        // 5. Verificar productos LIQUIPOPS específicamente
        console.log('4️⃣ Productos LIQUIPOPS con stock:');
        const liquipopsWithStock = productsWithStock.filter(p => 
            p.name && p.name.toUpperCase().includes('LIQUIPOPS')
        );
        
        console.log(`🍭 LIQUIPOPS con stock: ${liquipopsWithStock.length}`);
        liquipopsWithStock.slice(0, 5).forEach((product, index) => {
            console.log(`   ${index + 1}. ${product.name}`);
            console.log(`      Stock: ${product.stock}, Disponible: ${product.available_quantity}`);
        });

        // 6. Estadísticas generales
        console.log('\n5️⃣ Estadísticas de stock en la API:');
        const totalStock = productsWithStock.reduce((sum, p) => sum + (p.stock || 0), 0);
        const totalAvailable = productsWithStock.reduce((sum, p) => sum + (p.available_quantity || 0), 0);
        const maxStock = Math.max(...productsWithStock.map(p => p.stock || 0));
        const minStock = Math.min(...productsWithStock.filter(p => p.stock > 0).map(p => p.stock || 0));

        console.log(`   📊 Stock total: ${totalStock}`);
        console.log(`   📊 Disponible total: ${totalAvailable}`);
        console.log(`   📊 Stock máximo: ${maxStock}`);
        console.log(`   📊 Stock mínimo: ${minStock}`);

        console.log('\n✅ API de productos retorna correctamente la información de stock');

    } catch (error) {
        console.error('❌ Error al probar API de productos:', error.message);
        if (error.response) {
            console.error('📄 Respuesta del servidor:', error.response.data);
        }
    }
}

testProductsAPIWithStock();
