const axios = require('axios');

async function testDirectCategories() {
    console.log('🧪 Probando endpoint de categorías sin autenticación...');
    
    try {
        // Probar primero sin autenticación para ver si el endpoint existe
        const response = await axios.get('http://localhost:3001/api/products/categories');
        console.log('✅ Respuesta exitosa:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        if (error.response) {
            console.log(`❌ Error ${error.response.status}: ${error.response.statusText}`);
            console.log('📝 Datos de error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('❌ Error de conexión:', error.message);
        }
    } finally {
        process.exit(0);
    }
}

testDirectCategories();
