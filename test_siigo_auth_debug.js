require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function testSiigoAuth() {
    console.log('🔍 DIAGNOSTICANDO AUTENTICACIÓN SIIGO');
    
    const username = process.env.SIIGO_API_USERNAME;
    const accessKey = process.env.SIIGO_API_ACCESS_KEY;
    
    console.log('📋 Credenciales encontradas:');
    console.log('Username:', username);
    console.log('Access Key:', accessKey ? `${accessKey.substring(0, 10)}...` : 'NO ENCONTRADA');
    
    if (!username || !accessKey) {
        console.log('❌ Faltan credenciales SIIGO en el .env');
        return;
    }
    
    try {
        console.log('🚀 Intentando autenticación...');
        
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: username,
            access_key: accessKey
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Partner-Id': 'gestion_pedidos'
            },
            timeout: 30000
        });
        
        console.log('✅ Autenticación exitosa');
        console.log('Token recibido:', authResponse.data.access_token ? 'SÍ' : 'NO');
        
        // Test de productos para verificar el token
        if (authResponse.data.access_token) {
            console.log('🧪 Probando consulta de productos...');
            
            const productsResponse = await axios.get('https://api.siigo.com/v1/products?page_size=1', {
                headers: {
                    'Authorization': authResponse.data.access_token,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'gestion_pedidos'
                },
                timeout: 30000
            });
            
            console.log('✅ Consulta de productos exitosa');
            console.log('Productos encontrados:', productsResponse.data.pagination?.total_results || 'N/A');
        }
        
    } catch (error) {
        console.log('❌ Error de autenticación:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.log('Error de conexión:', error.message);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testSiigoAuth().catch(console.error);
