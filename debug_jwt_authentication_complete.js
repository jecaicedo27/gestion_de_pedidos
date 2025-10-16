const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Función para mostrar headers de manera legible
const showHeaders = (headers, title) => {
    console.log(`\n📋 ${title}:`);
    Object.keys(headers).forEach(key => {
        console.log(`   ${key}: ${headers[key]}`);
    });
};

// Función para mostrar respuesta detallada
const showResponse = (response, title) => {
    console.log(`\n✅ ${title}:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Data:`, JSON.stringify(response.data, null, 2));
    showHeaders(response.headers, 'Response Headers');
};

// Función para mostrar error detallado
const showError = (error, title) => {
    console.log(`\n❌ ${title}:`);
    if (error.response) {
        console.log(`   Status: ${error.response.status} ${error.response.statusText}`);
        console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
        showHeaders(error.response.headers, 'Error Response Headers');
    } else if (error.request) {
        console.log(`   No response received:`, error.message);
    } else {
        console.log(`   Request setup error:`, error.message);
    }
};

// Función para analizar JWT token
const analyzeJWT = (token) => {
    try {
        console.log(`\n🔍 ANÁLISIS JWT TOKEN:`);
        console.log(`   Token completo: ${token.substring(0, 50)}...`);
        
        const parts = token.split('.');
        console.log(`   Partes del token: ${parts.length}`);
        
        if (parts.length === 3) {
            // Decodificar header
            const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
            console.log(`   Header:`, JSON.stringify(header, null, 2));
            
            // Decodificar payload
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            console.log(`   Payload:`, JSON.stringify(payload, null, 2));
            
            // Verificar campos críticos
            console.log(`\n🔎 CAMPOS CRÍTICOS:`);
            console.log(`   userId: ${payload.userId}`);
            console.log(`   id: ${payload.id}`);
            console.log(`   username: ${payload.username}`);
            console.log(`   role: ${payload.role}`);
            console.log(`   iat: ${payload.iat} (${new Date(payload.iat * 1000)})`);
            console.log(`   exp: ${payload.exp} (${new Date(payload.exp * 1000)})`);
            
            // Verificar si está expirado
            const now = Math.floor(Date.now() / 1000);
            const isExpired = payload.exp < now;
            console.log(`   Expirado: ${isExpired ? '❌ SÍ' : '✅ NO'}`);
            console.log(`   Tiempo restante: ${payload.exp - now} segundos`);
            
            return payload;
        } else {
            console.log(`   ❌ Token malformado: ${parts.length} partes`);
            return null;
        }
    } catch (error) {
        console.log(`   ❌ Error analizando token: ${error.message}`);
        return null;
    }
};

async function debugAuthentication() {
    console.log('🚀 DEPURACIÓN COMPLETA DE AUTENTICACIÓN JWT');
    console.log('='.repeat(50));
    
    let token = null;
    let payload = null;
    
    try {
        // ============= PASO 1: LOGIN =============
        console.log('\n📝 PASO 1: PRUEBA DE LOGIN');
        
        const loginData = {
            username: 'admin',
            password: 'admin123'
        };
        
        console.log('Enviando credenciales:', loginData);
        
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, loginData, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        showResponse(loginResponse, 'LOGIN EXITOSO');
        
        if (loginResponse.data && loginResponse.data.data && loginResponse.data.data.token) {
            token = loginResponse.data.data.token;
            payload = analyzeJWT(token);
        } else {
            console.log('❌ No se recibió token en la respuesta');
            console.log('Estructura de respuesta:', JSON.stringify(loginResponse.data, null, 2));
            return;
        }
        
    } catch (error) {
        showError(error, 'ERROR EN LOGIN');
        return;
    }
    
    // ============= PASO 2: VERIFICAR TOKEN CON ENDPOINT SIIGO =============
    console.log('\n📝 PASO 2: PRUEBA CON ENDPOINT SIIGO (REFERENCIA)');
    
    try {
        const siigoResponse = await axios.get(`${BASE_URL}/api/siigo/invoices?page=1&page_size=1`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        showResponse(siigoResponse, 'SIIGO ENDPOINT EXITOSO');
        
    } catch (error) {
        showError(error, 'ERROR EN SIIGO ENDPOINT');
    }
    
    // ============= PASO 3: PROBAR ENDPOINTS DE QUOTATIONS =============
    console.log('\n📝 PASO 3: PRUEBAS DE ENDPOINTS QUOTATIONS');
    
    const quotationEndpoints = [
        { method: 'GET', path: '/api/quotations', description: 'Listar cotizaciones' },
        { method: 'GET', path: '/api/quotations/stats', description: 'Estadísticas' },
        { method: 'GET', path: '/api/quotations/customers/search?query=test', description: 'Buscar clientes' },
        { method: 'GET', path: '/api/quotations/customers/stats', description: 'Estadísticas de clientes' }
    ];
    
    for (const endpoint of quotationEndpoints) {
        console.log(`\n🔍 Probando: ${endpoint.method} ${endpoint.path}`);
        console.log(`   Descripción: ${endpoint.description}`);
        
        try {
            const config = {
                method: endpoint.method,
                url: `${BASE_URL}${endpoint.path}`,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };
            
            console.log(`   Headers enviados:`);
            Object.keys(config.headers).forEach(key => {
                const value = key === 'Authorization' ? 
                    `Bearer ${token.substring(0, 20)}...` : 
                    config.headers[key];
                console.log(`      ${key}: ${value}`);
            });
            
            const response = await axios(config);
            showResponse(response, `ÉXITO EN ${endpoint.path}`);
            
        } catch (error) {
            showError(error, `ERROR EN ${endpoint.path}`);
            
            // Análisis adicional del error 401
            if (error.response && error.response.status === 401) {
                console.log(`\n🔬 ANÁLISIS ESPECÍFICO DEL ERROR 401:`);
                console.log(`   Mensaje: ${error.response.data?.message || 'No message'}`);
                console.log(`   Success: ${error.response.data?.success || 'No success field'}`);
                
                // Verificar si el token aún es válido
                if (payload) {
                    const now = Math.floor(Date.now() / 1000);
                    const timeLeft = payload.exp - now;
                    console.log(`   Token válido por: ${timeLeft} segundos`);
                    
                    if (timeLeft <= 0) {
                        console.log(`   ❌ Token EXPIRADO`);
                    } else {
                        console.log(`   ✅ Token AÚN VÁLIDO`);
                    }
                }
            }
        }
        
        // Pequeña pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ============= PASO 4: COMPARACIÓN DIRECTA =============
    console.log('\n📝 PASO 4: COMPARACIÓN DIRECTA DE MIDDLEWARES');
    
    // Probar un endpoint que sabemos que funciona vs uno que falla
    const comparisons = [
        { 
            name: 'SIIGO (funciona)',
            method: 'GET',
            url: `${BASE_URL}/api/siigo/invoices?page=1&page_size=1`
        },
        {
            name: 'QUOTATIONS (falla)',
            method: 'GET', 
            url: `${BASE_URL}/api/quotations/stats`
        }
    ];
    
    for (const comp of comparisons) {
        console.log(`\n🔄 Comparando: ${comp.name}`);
        
        try {
            const response = await axios({
                method: comp.method,
                url: comp.url,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   📊 Data keys: ${Object.keys(response.data || {}).join(', ')}`);
            
        } catch (error) {
            console.log(`   ❌ Status: ${error.response?.status || 'No response'}`);
            console.log(`   💬 Message: ${error.response?.data?.message || error.message}`);
        }
    }
    
    // ============= RESUMEN =============
    console.log('\n📊 RESUMEN DE DIAGNÓSTICO');
    console.log('='.repeat(50));
    console.log(`✅ Login: Exitoso`);
    console.log(`🔑 Token: ${token ? 'Generado correctamente' : 'No generado'}`);
    console.log(`📝 Payload: ${payload ? 'Válido' : 'Inválido'}`);
    
    if (payload) {
        console.log(`👤 Usuario: ${payload.username} (ID: ${payload.userId || payload.id})`);
        console.log(`🏷️ Rol: ${payload.role}`);
        console.log(`⏰ Expira: ${new Date(payload.exp * 1000).toLocaleString()}`);
    }
    
    console.log('\n💡 PRÓXIMOS PASOS:');
    console.log('1. Si el token es válido pero quotations falla, revisar middleware de quotations');
    console.log('2. Si el token es inválido, revisar generación en login');
    console.log('3. Comparar implementación de auth entre siigo.js y quotations.js');
    console.log('4. Verificar variables de entorno (JWT_SECRET)');
}

// Ejecutar diagnóstico
debugAuthentication().catch(error => {
    console.error('❌ Error en diagnóstico:', error.message);
    process.exit(1);
});
