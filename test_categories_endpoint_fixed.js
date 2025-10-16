const axios = require('axios');

async function testCategoriesEndpoint() {
    console.log('🧪 Probando endpoint de categorías corregido...');
    
    try {
        // Primero obtener un token de autenticación
        console.log('🔐 Autenticando usuario...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Token obtenido');
        
        // Ahora probar el endpoint de categorías
        console.log('📂 Consultando endpoint /api/products/categories...');
        const categoriesResponse = await axios.get('http://localhost:3001/api/products/categories', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Respuesta exitosa del endpoint:');
        console.log('📊 Número de categorías:', categoriesResponse.data.data.length);
        console.log('📂 Categorías encontradas:');
        
        categoriesResponse.data.data.forEach((cat, index) => {
            console.log(`${index + 1}. "${cat.label}" (${cat.count} productos)`);
        });
        
        console.log('\n🎉 ¡Endpoint funcionando correctamente!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📄 Respuesta del servidor:', error.response.status);
            console.error('📝 Datos de error:', error.response.data);
        }
    } finally {
        process.exit(0);
    }
}

testCategoriesEndpoint();
