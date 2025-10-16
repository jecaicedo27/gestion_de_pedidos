const axios = require('axios');

// Debug the backend errors with quotations
async function debugQuotationsBackendErrors() {
    console.log('🔍 DEBUGGING BACKEND QUOTATIONS ERRORS');
    console.log('=====================================\n');

    const API_BASE_URL = 'http://localhost:3001/api';
    
    try {
        // Test 1: Check the server logs or backend status
        console.log('🚀 1. BACKEND STATUS CHECK');
        console.log('---------------------------');
        
        try {
            const healthCheck = await axios.get(`${API_BASE_URL}/../health`, { timeout: 5000 });
            console.log('✅ Backend responde:', healthCheck.status);
        } catch (error) {
            // Try alternative health check
            try {
                const serverCheck = await axios.get('http://localhost:3001/', { 
                    timeout: 5000,
                    validateStatus: (status) => status < 500
                });
                console.log('✅ Backend activo en puerto 3001');
            } catch (serverError) {
                console.log('❌ Backend no responde correctamente');
            }
        }

        // Test 2: Check quotations endpoint without auth first
        console.log('\n📋 2. QUOTATIONS ENDPOINT TEST');
        console.log('-------------------------------');
        
        try {
            const quotationsTest = await axios.get(`${API_BASE_URL}/quotations`, {
                timeout: 5000,
                validateStatus: (status) => status < 500
            });
            console.log(`📊 Status: ${quotationsTest.status}`);
            if (quotationsTest.status === 401) {
                console.log('🔒 Requiere autenticación (esperado)');
            } else if (quotationsTest.status === 400) {
                console.log('❌ Error 400 - Posible problema de validación');
                console.log('📝 Respuesta:', quotationsTest.data);
            }
        } catch (error) {
            console.log('❌ Error en endpoint quotations:', error.message);
            if (error.response) {
                console.log(`📊 Status: ${error.response.status}`);
                console.log(`📝 Data:`, error.response.data);
            }
        }

        // Test 3: Check SIIGO invoice creation endpoint
        console.log('\n💼 3. SIIGO INVOICE ENDPOINT TEST');
        console.log('----------------------------------');
        
        try {
            // Test with minimal data to see the exact error
            const siigoTest = await axios.post(`${API_BASE_URL}/quotations/create-siigo-with-chatgpt`, {
                test: true
            }, {
                timeout: 5000,
                validateStatus: (status) => status < 600
            });
            
            console.log(`📊 Status: ${siigoTest.status}`);
            if (siigoTest.status >= 400) {
                console.log('📝 Error response:', siigoTest.data);
            }
        } catch (error) {
            console.log('❌ Error en SIIGO endpoint:', error.message);
            if (error.response) {
                console.log(`📊 Status: ${error.response.status}`);
                console.log(`📝 Error data:`, error.response.data);
                
                // Common 500 error causes
                if (error.response.status === 500) {
                    console.log('\n🔍 POSIBLES CAUSAS DEL ERROR 500:');
                    console.log('   - Configuración SIIGO faltante o incorrecta');
                    console.log('   - Error en ChatGPT API (OpenAI key, quota, etc.)');
                    console.log('   - Error de base de datos');
                    console.log('   - Error en validación de datos');
                    console.log('   - Error en servicios dependencies');
                }
            }
        }

        // Test 4: Check specific endpoints that might be causing issues
        console.log('\n🔧 4. ENDPOINT DEPENDENCIES CHECK');
        console.log('-----------------------------------');
        
        // Check if customers endpoint works
        try {
            const customersTest = await axios.get(`${API_BASE_URL}/quotations/customers/search?search=test`, {
                timeout: 5000,
                validateStatus: (status) => status < 500
            });
            console.log('✅ Customers search endpoint:', customersTest.status === 401 ? 'Requiere auth' : `Status ${customersTest.status}`);
        } catch (error) {
            console.log('❌ Customers endpoint error:', error.response?.status || error.message);
        }

        // Test 5: Check backend logs hint
        console.log('\n📊 5. BACKEND LOGS ANALYSIS');
        console.log('----------------------------');
        console.log('💡 Para ver logs detallados del backend:');
        console.log('   1. Busca en la consola del backend los errores 500');
        console.log('   2. Revisa si hay errores de:');
        console.log('      - Conexión a base de datos');
        console.log('      - OpenAI API configuration');
        console.log('      - SIIGO API configuration');
        console.log('      - Missing environment variables');
        console.log('      - Validation errors');

        // Test 6: Common fixes suggestions
        console.log('\n🛠️  6. SOLUCIONES COMUNES');
        console.log('-------------------------');
        console.log('✅ Verificar variables de entorno:');
        console.log('   - OPENAI_API_KEY');
        console.log('   - SIIGO_API_TOKEN');
        console.log('   - Database connection');
        console.log('');
        console.log('✅ Verificar estructura de base de datos:');
        console.log('   - Tabla quotations existe');
        console.log('   - Tabla customers existe');
        console.log('   - Tabla chatgpt_logs existe');
        console.log('');
        console.log('✅ Verificar servicios:');
        console.log('   - ChatGPT service inicializado');
        console.log('   - SIIGO service configurado');
        console.log('   - Rate limiting no bloqueando');

    } catch (error) {
        console.log('❌ Error general:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNÓSTICO BACKEND ERRORS');
    console.log('='.repeat(60));
    console.log('🔍 Los errores 500 y 400 indican:');
    console.log('   1. Error 500: Problema interno del servidor');
    console.log('   2. Error 400: Datos de entrada inválidos');
    console.log('   3. Notification error: Sistema de notificaciones falla');
    console.log('');
    console.log('🛠️  SIGUIENTE PASO:');
    console.log('   Revisar los logs del backend para identificar');
    console.log('   el error específico y solucionarlo.');
    console.log('='.repeat(60));
}

debugQuotationsBackendErrors().catch(console.error);
