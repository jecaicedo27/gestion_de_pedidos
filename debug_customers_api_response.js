const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function debugCustomersAPI() {
    try {
        // 1. Login
        console.log('=== INICIANDO SESIÓN ===');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso\n');
        
        // 2. Consultar API de clientes y mostrar respuesta completa
        console.log('=== DEBUG RESPUESTA DE CLIENTES ===');
        const customersResponse = await axios.get(`${API_URL}/customers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Status Code:', customersResponse.status);
        console.log('Headers:', customersResponse.headers['content-type']);
        console.log('\nRespuesta completa:');
        console.log(JSON.stringify(customersResponse.data, null, 2));
        
        console.log('\nAnalisis de la estructura:');
        console.log('customersResponse.data:', typeof customersResponse.data);
        console.log('customersResponse.data.data:', typeof customersResponse.data?.data);
        
        if (customersResponse.data) {
            console.log('customersResponse.data keys:', Object.keys(customersResponse.data));
        }
        
        if (customersResponse.data?.data) {
            console.log('customersResponse.data.data es array:', Array.isArray(customersResponse.data.data));
            console.log('customersResponse.data.data length:', customersResponse.data.data?.length);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.response?.data || error.message);
        if (error.response?.status) {
            console.error('Status:', error.response.status);
        }
    }
}

debugCustomersAPI();
