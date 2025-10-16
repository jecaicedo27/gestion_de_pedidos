const axios = require('axios');

async function testProductsAPI() {
    console.log('🔍 Probando API de productos...');
    
    // Token de ejemplo - necesitarás usar un token válido
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MjU5MTE4NDEsImV4cCI6MTcyNTk5ODI0MX0.5rWxG5O8oZRpLUgvWyMhKi7mCFQ_wQWHFmdO8tWnwCc';
    
    const baseURL = 'http://localhost:3001';
    
    try {
        // Test 1: Obtener productos
        console.log('\n📋 Test 1: Obteniendo productos...');
        const response1 = await axios.get(`${baseURL}/api/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Productos obtenidos:', response1.data.data?.length || 0);
        
        // Test 2: Obtener estadísticas
        console.log('\n📊 Test 2: Obteniendo estadísticas...');
        const response2 = await axios.get(`${baseURL}/api/products/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Estadísticas obtenidas:', response2.data.data);
        
        // Test 3: Buscar por código de barras
        console.log('\n🔎 Test 3: Buscando producto por código de barras...');
        const response3 = await axios.get(`${baseURL}/api/products/barcode/7701234567890`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Producto encontrado:', response3.data.data?.product_name || 'No encontrado');
        
        console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('\n💡 Necesitas un token válido. Puedes obtener uno haciendo login en la aplicación.');
        }
    }
}

// Ejecutar las pruebas
testProductsAPI();
