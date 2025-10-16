const axios = require('axios');

console.log('🔍 VERIFICANDO ESTADO DEL BACKEND Y DROPDOWN DE CLIENTES');
console.log('========================================================');

async function testBackendStatus() {
    try {
        // 1. Test config endpoint
        console.log('\n1. Probando endpoint de configuración...');
        const configResponse = await axios.get('http://localhost:3001/api/config/public');
        console.log('✅ Config endpoint working:', configResponse.status);
        
        // 2. Test customers endpoint with authentication
        console.log('\n2. Probando endpoint de búsqueda de clientes...');
        
        // First login to get token
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin@liquipops.com',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful, token obtained');
        
        // Test customer search
        const customersResponse = await axios.get('http://localhost:3001/api/quotations/customers/search?q=', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Customer search endpoint working:', customersResponse.status);
        console.log('📊 Customers found:', customersResponse.data.length);
        
        if (customersResponse.data.length > 0) {
            console.log('🎯 Sample customer:', {
                id: customersResponse.data[0].id,
                name: customersResponse.data[0].commercial_name || customersResponse.data[0].name,
                document: customersResponse.data[0].identification
            });
        }
        
        console.log('\n✅ BACKEND Y DROPDOWN DE CLIENTES FUNCIONANDO CORRECTAMENTE');
        console.log('🎉 El usuario puede ahora usar la búsqueda de clientes en cotizaciones');
        
    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('🚨 BACKEND NO ESTÁ EJECUTÁNDOSE - Necesita iniciar el backend');
        } else if (error.response) {
            console.log('📋 Status:', error.response.status);
            console.log('📋 Response:', error.response.data);
        }
    }
}

testBackendStatus();
