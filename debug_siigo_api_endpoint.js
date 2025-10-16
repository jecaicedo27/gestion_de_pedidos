const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

async function debugSiigoApiEndpoint() {
    console.log('🔍 INVESTIGANDO ENDPOINT CORRECTO DE SIIGO API PARA PRODUCTOS');
    console.log('=================================================================');
    
    try {
        // 1. Authenticate with SIIGO
        console.log('\n1️⃣ AUTENTICANDO CON SIIGO API');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        });
        
        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');
        console.log(`🔑 Token: ${token.substring(0, 20)}...`);
        
        // 2. Test different product endpoints
        const testProductId = 'LIQUIPP14'; // One we know exists
        
        console.log(`\n2️⃣ PROBANDO DIFERENTES ENDPOINTS PARA PRODUCTO: ${testProductId}`);
        
        // Test endpoint 1: /v1/products/{id}
        console.log('\n📍 Probando: GET /v1/products/{id}');
        try {
            const response1 = await axios.get(`https://api.siigo.com/v1/products/${testProductId}`, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'siigo'
                }
            });
            console.log('✅ Endpoint funciona:', response1.status);
            console.log('📦 Estructura de respuesta:');
            console.log(JSON.stringify(response1.data, null, 2));
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.statusText);
            if (error.response?.data) {
                console.log('📝 Detalles del error:');
                console.log(JSON.stringify(error.response.data, null, 2));
            }
        }
        
        // Test endpoint 2: /v1/products (GET all with filter)
        console.log('\n📍 Probando: GET /v1/products?code={id}');
        try {
            const response2 = await axios.get(`https://api.siigo.com/v1/products?code=${testProductId}`, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'siigo'
                }
            });
            console.log('✅ Endpoint funciona:', response2.status);
            console.log('📦 Número de productos encontrados:', response2.data.results?.length || 'No results property');
            if (response2.data.results && response2.data.results.length > 0) {
                console.log('📝 Primer producto:');
                console.log(JSON.stringify(response2.data.results[0], null, 2));
            }
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.statusText);
            if (error.response?.data) {
                console.log('📝 Detalles del error:');
                console.log(JSON.stringify(error.response.data, null, 2));
            }
        }
        
        // Test endpoint 3: /v1/products without Partner-Id
        console.log('\n📍 Probando: GET /v1/products/{id} SIN Partner-Id');
        try {
            const response3 = await axios.get(`https://api.siigo.com/v1/products/${testProductId}`, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Endpoint funciona:', response3.status);
            console.log('📦 Respuesta:', response3.data.name || response3.data.description || 'Sin name/description');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.statusText);
        }
        
        // Test endpoint 4: Check if we need to use a different product identifier
        console.log('\n📍 Probando: GET /v1/products (listar primeros 5)');
        try {
            const response4 = await axios.get('https://api.siigo.com/v1/products?page_size=5', {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'siigo'
                }
            });
            console.log('✅ Endpoint funciona:', response4.status);
            console.log('📦 Productos encontrados:', response4.data.results?.length || 0);
            if (response4.data.results && response4.data.results.length > 0) {
                console.log('📝 Estructura del primer producto:');
                const firstProduct = response4.data.results[0];
                console.log({
                    id: firstProduct.id,
                    code: firstProduct.code,
                    name: firstProduct.name,
                    available_quantity: firstProduct.available_quantity,
                    stock_control: firstProduct.stock_control
                });
            }
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.statusText);
            if (error.response?.data) {
                console.log('📝 Detalles del error:');
                console.log(JSON.stringify(error.response.data, null, 2));
            }
        }
        
        console.log('\n✅ INVESTIGACIÓN COMPLETADA');
        
    } catch (error) {
        console.error('\n❌ ERROR EN INVESTIGACIÓN:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Ejecutar la investigación
debugSiigoApiEndpoint().catch(console.error);
