const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testBarcode() {
    console.log('🧪 PRUEBA SIMPLE DE ESCANEO DE CÓDIGOS\n');
    
    try {
        // 1. Login
        console.log('📋 PASO 1: Login...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('   Token recibido:', token.substring(0, 50) + '...');
        
        // 2. Configurar headers con diferentes formatos
        const headers1 = { 'Authorization': token };
        const headers2 = { 'authorization': token };
        const headers3 = { 'Authorization': `Bearer ${token}` };
        
        console.log('\n📋 PASO 2: Probando diferentes formatos de header...\n');
        
        // Probar formato 1
        console.log('   Probando con Authorization: token');
        try {
            const response1 = await axios.get(`${API_BASE}/packaging/pending`, { headers: headers1 });
            console.log('   ✅ Formato 1 funcionó');
            console.log(`   Pedidos encontrados: ${response1.data.data.length}`);
            return;
        } catch (error) {
            console.log('   ❌ Formato 1 falló:', error.response?.data?.message);
        }
        
        // Probar formato 2
        console.log('\n   Probando con authorization: token');
        try {
            const response2 = await axios.get(`${API_BASE}/packaging/pending`, { headers: headers2 });
            console.log('   ✅ Formato 2 funcionó');
            console.log(`   Pedidos encontrados: ${response2.data.data.length}`);
            return;
        } catch (error) {
            console.log('   ❌ Formato 2 falló:', error.response?.data?.message);
        }
        
        // Probar formato 3
        console.log('\n   Probando con Authorization: Bearer token');
        try {
            const response3 = await axios.get(`${API_BASE}/packaging/pending`, { headers: headers3 });
            console.log('   ✅ Formato 3 funcionó');
            console.log(`   Pedidos encontrados: ${response3.data.data.length}`);
            return;
        } catch (error) {
            console.log('   ❌ Formato 3 falló:', error.response?.data?.message);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data?.message || error.message);
    }
}

// Ejecutar prueba
testBarcode();
