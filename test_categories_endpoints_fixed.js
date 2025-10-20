const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

console.log('🧪 Testeando endpoints de categorías después del fix...\n');

async function testCategoriesEndpoints() {
  try {
    // Test health endpoint first
    console.log('1. Verificando que el backend esté corriendo...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log(`✅ Backend está corriendo: ${healthResponse.data.message}\n`);

    // Test /api/siigo-categories/live endpoint
    console.log('2. Testeando endpoint /api/siigo-categories/live...');
    try {
      const liveResponse = await axios.get(`${BASE_URL}/api/siigo-categories/live`);
      console.log('✅ Endpoint /live funcionando correctamente');
      console.log('📊 Response structure:', Object.keys(liveResponse.data));
      console.log('🏷️ Categories found:', liveResponse.data.data?.length || 0);
      if (liveResponse.data.data) {
        console.log('📋 First 5 categories:', liveResponse.data.data.slice(0, 5));
      }
    } catch (error) {
      console.log('❌ Error en endpoint /live:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('📄 Error details:', error.response.data);
      }
    }

    console.log('\n');

    // Test /api/siigo-categories/local endpoint  
    console.log('3. Testeando endpoint /api/siigo-categories/local...');
    try {
      const localResponse = await axios.get(`${BASE_URL}/api/siigo-categories/local`);
      console.log('✅ Endpoint /local funcionando correctamente');
      console.log('🏷️ Categories found:', localResponse.data?.length || 0);
      if (Array.isArray(localResponse.data)) {
        console.log('📋 First 5 categories:', localResponse.data.slice(0, 5));
        
        // Check if we have the required categories
        const requiredCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS'];
        console.log('\n🔍 Verificando categorías requeridas:');
        requiredCategories.forEach(category => {
          const found = localResponse.data.includes(category);
          console.log(`  ${found ? '✅' : '❌'} ${category}: ${found ? 'ENCONTRADA' : 'NO ENCONTRADA'}`);
        });
      }
    } catch (error) {
      console.log('❌ Error en endpoint /local:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('📄 Error details:', error.response.data);
      }
    }

  } catch (error) {
    console.log('❌ Backend no está corriendo o hay problemas de conectividad');
    console.log('📄 Error:', error.message);
    console.log('\n💡 Asegúrate de que el backend esté corriendo en el puerto 3001');
  }
}

testCategoriesEndpoints();
