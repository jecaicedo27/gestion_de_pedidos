const axios = require('axios');

/**
 * Test simple de autenticación para diagnosticar el problema del token JWT
 */

const BASE_URL = 'http://localhost:3001';

async function testAuthToken() {
    try {
        console.log('🔐 Probando autenticación...');

        // Paso 1: Login
        console.log('1. Haciendo login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        console.log('✅ Login exitoso');
        console.log('📋 Respuesta del login:', JSON.stringify(loginResponse.data, null, 2));

        const token = loginResponse.data.data.token;
        console.log('🔑 Token recibido:', token);
        console.log('📏 Longitud del token:', token?.length);
        console.log('🔍 Tipo de token:', typeof token);

        // Verificar si el token tiene el formato correcto
        if (token) {
            const parts = token.split('.');
            console.log('🧩 Partes del JWT:', parts.length);
            console.log('🧩 Primera parte (header):', parts[0]?.substring(0, 20) + '...');
            console.log('🧩 Segunda parte (payload):', parts[1]?.substring(0, 20) + '...');
            console.log('🧩 Tercera parte (signature):', parts[2]?.substring(0, 20) + '...');
        }

        // Paso 2: Probar el token con una llamada autenticada
        console.log('\n2. Probando token con una llamada autenticada...');
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log('📋 Headers a enviar:', JSON.stringify(headers, null, 2));

        // Probar con un endpoint simple que requiera autenticación
        const testResponse = await axios.get(`${BASE_URL}/api/quotations/customers/search?q=test`, {
            headers
        });

        console.log('✅ Llamada autenticada exitosa');
        console.log('📋 Respuesta:', testResponse.data);

        return {
            success: true,
            token: token,
            message: 'Autenticación funcionando correctamente'
        };

    } catch (error) {
        console.error('\n❌ Error en autenticación:', error.message);
        
        if (error.response) {
            console.error('📋 Status:', error.response.status);
            console.error('📋 Data:', JSON.stringify(error.response.data, null, 2));
            console.error('📋 Headers:', JSON.stringify(error.response.headers, null, 2));
        }

        if (error.config) {
            console.error('📋 Config enviado:', JSON.stringify({
                url: error.config.url,
                method: error.config.method,
                headers: error.config.headers
            }, null, 2));
        }

        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
}

// Ejecutar el test
console.log('🚀 Iniciando test de autenticación JWT\n');

testAuthToken()
    .then(result => {
        console.log('\n📊 Resultado del test:');
        if (result.success) {
            console.log('✅ Autenticación funcionando');
            console.log('🎯 Token válido y funcional');
        } else {
            console.log('❌ Problema de autenticación detectado');
            console.log('🔧 Se requiere corrección del token JWT');
        }
    })
    .catch(error => {
        console.error('\n💥 Error crítico en el test:', error.message);
    });
