const axios = require('axios');

async function testCategoriesEndpoints() {
  const baseURL = 'http://localhost:3001';
  
  console.log('🧪 Probando endpoints de categorías directamente...\n');
  
  // Probar endpoint /live
  try {
    console.log('📍 Probando /api/siigo-categories/live...');
    const liveResponse = await axios.get(`${baseURL}/api/siigo-categories/live`);
    
    console.log('✅ Respuesta exitosa del endpoint /live:');
    console.log('Status:', liveResponse.status);
    console.log('Data:', JSON.stringify(liveResponse.data, null, 2));
    
    if (liveResponse.data.success && liveResponse.data.data) {
      console.log(`📊 Categorías obtenidas: ${liveResponse.data.data.length}`);
      liveResponse.data.data.forEach((cat, index) => {
        console.log(`  ${index + 1}. ${cat}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Error en endpoint /live:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
      console.log('Headers:', error.response.headers);
    } else if (error.request) {
      console.log('❌ No hay respuesta del servidor');
      console.log('Request:', error.request.path);
    } else {
      console.log('❌ Error configurando request:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Probar endpoint /local
  try {
    console.log('📍 Probando /api/siigo-categories/local...');
    const localResponse = await axios.get(`${baseURL}/api/siigo-categories/local`);
    
    console.log('✅ Respuesta exitosa del endpoint /local:');
    console.log('Status:', localResponse.status);
    console.log('Data:', JSON.stringify(localResponse.data, null, 2));
    
    if (Array.isArray(localResponse.data)) {
      console.log(`📊 Categorías obtenidas: ${localResponse.data.length}`);
      localResponse.data.forEach((cat, index) => {
        console.log(`  ${index + 1}. ${cat}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Error en endpoint /local:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
      console.log('Headers:', error.response.headers);
    } else if (error.request) {
      console.log('❌ No hay respuesta del servidor');
      console.log('Request:', error.request.path);
    } else {
      console.log('❌ Error configurando request:', error.message);
    }
  }
  
  // Probar health endpoint para verificar si el servidor está funcionando
  console.log('\n' + '='.repeat(50) + '\n');
  
  try {
    console.log('📍 Probando /api/health...');
    const healthResponse = await axios.get(`${baseURL}/api/health`);
    
    console.log('✅ Servidor funcionando correctamente:');
    console.log('Status:', healthResponse.status);
    console.log('Data:', JSON.stringify(healthResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error en health check - ¿Está el servidor ejecutándose?');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else if (error.request) {
      console.log('❌ No se puede conectar al servidor en http://localhost:3001');
      console.log('💡 Ejecuta: node backend/server.js o npm run dev en el backend');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testCategoriesEndpoints();
