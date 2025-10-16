const axios = require('axios');

async function testCategoriesWithAuth() {
    console.log('🧪 Probando endpoint de categorías con autenticación...');
    
    try {
        // Primero autenticarse
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Autenticación exitosa');

        // Ahora probar el endpoint de categorías
        const categoriesResponse = await axios.get('http://localhost:3001/api/products/categories', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('\n📂 CATEGORÍAS OBTENIDAS:');
        console.log('═'.repeat(60));
        
        const categories = categoriesResponse.data.data;
        categories.forEach((cat, index) => {
            console.log(`${index + 1}. ${cat.label} (${cat.count} productos)`);
        });

        console.log('═'.repeat(60));
        console.log(`📈 TOTAL: ${categories.length} categorías\n`);

        // Verificar que LIQUIPOPS esté incluido
        const liquipopsCategory = categories.find(cat => cat.label.includes('LIQUIPOPS'));
        if (liquipopsCategory) {
            console.log('✅ LIQUIPOPS encontrado:', liquipopsCategory);
        } else {
            console.log('❌ LIQUIPOPS NO encontrado');
        }

    } catch (error) {
        if (error.response) {
            console.log(`❌ Error ${error.response.status}: ${error.response.statusText}`);
            console.log('📝 Datos de error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('❌ Error de conexión:', error.message);
        }
    }
}

testCategoriesWithAuth();
