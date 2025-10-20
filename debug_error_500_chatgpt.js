// Script para debugear el nuevo error 500 de ChatGPT
const fetch = require('node-fetch');

async function debugError500() {
    console.log('🔍 Debugeando Error 500 del servidor ChatGPT');
    console.log('=============================================\n');

    try {
        // Configurar variables de entorno
        require('dotenv').config({ path: './backend/.env' });
        
        console.log('1. 🧪 Haciendo request al endpoint exacto...');
        
        // Hacer el mismo request que está fallando en el frontend
        const response = await fetch('http://localhost:3001/api/quotations/process-natural-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token' // Token de prueba
            },
            body: JSON.stringify({
                customer_id: 1,
                natural_language_order: '20 sal limón de 250g',
                processing_type: 'text'
            })
        });

        console.log('📊 Status de respuesta:', response.status);
        console.log('📋 Headers de respuesta:');
        response.headers.forEach((value, key) => {
            console.log(`   ${key}: ${value}`);
        });

        // Intentar leer la respuesta como texto primero
        const responseText = await response.text();
        console.log('\n📄 Respuesta completa del servidor:');
        console.log('-----------------------------------');
        console.log(responseText);
        console.log('-----------------------------------');

        // Verificar si es JSON válido
        try {
            const jsonData = JSON.parse(responseText);
            console.log('✅ Es JSON válido:', JSON.stringify(jsonData, null, 2));
        } catch (jsonError) {
            console.log('❌ NO es JSON válido');
            console.log('🔍 Tipo de respuesta detectada:');
            
            if (responseText.includes('Proxy error') || responseText.includes('proxy')) {
                console.log('   🔴 ERROR DE PROXY detectado');
                console.log('   💡 El servidor puede estar caído o hay problemas de red');
            } else if (responseText.includes('Cannot GET') || responseText.includes('Cannot POST')) {
                console.log('   🔴 RUTA NO ENCONTRADA');
                console.log('   💡 El endpoint no existe o hay un problema de routing');
            } else if (responseText.includes('Error') && responseText.includes('500')) {
                console.log('   🔴 ERROR INTERNO DEL SERVIDOR');
                console.log('   💡 Hay un crash en el código del backend');
            } else if (responseText.includes('<html>') || responseText.includes('<body>')) {
                console.log('   🔴 PÁGINA HTML EN LUGAR DE API');
                console.log('   💡 El servidor web devuelve HTML en lugar de JSON');
            } else {
                console.log('   🔴 ERROR DESCONOCIDO');
                console.log('   💡 Respuesta no estándar del servidor');
            }
        }

    } catch (error) {
        console.log('❌ Error en el request:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.log('🔴 SERVIDOR NO ESTÁ EJECUTÁNDOSE');
            console.log('💡 El backend no está corriendo en el puerto 3001');
            await checkBackendStatus();
        } else if (error.message.includes('ENOTFOUND')) {
            console.log('🔴 PROBLEMA DE DNS/RED');
            console.log('💡 No puede resolver localhost');
        } else {
            console.log('🔴 ERROR DE RED DESCONOCIDO');
        }
    }

    console.log('\n🔧 DIAGNÓSTICOS ADICIONALES:');
    await checkBackendProcess();
    await checkRouteExists();
}

async function checkBackendStatus() {
    console.log('\n2. 🔍 Verificando estado del backend...');
    
    try {
        const healthCheck = await fetch('http://localhost:3001/health', {
            method: 'GET',
            timeout: 5000
        });
        
        if (healthCheck.ok) {
            console.log('✅ Backend está ejecutándose');
        } else {
            console.log('⚠️ Backend responde pero con problemas:', healthCheck.status);
        }
    } catch (error) {
        console.log('❌ Backend NO está ejecutándose');
        console.log('💡 Necesitas iniciar el servidor: npm start en la carpeta backend');
    }
}

async function checkBackendProcess() {
    console.log('\n3. 🔍 Verificando proceso del backend...');
    
    try {
        // Intentar hacer ping al servidor básico
        const basicCheck = await fetch('http://localhost:3001/', {
            method: 'GET',
            timeout: 3000
        });
        
        const text = await basicCheck.text();
        console.log('📋 Respuesta del servidor root:', text.substring(0, 100));
        
    } catch (error) {
        console.log('❌ No hay respuesta del puerto 3001');
        console.log('🚨 ACCIÓN REQUERIDA: Iniciar el backend');
    }
}

async function checkRouteExists() {
    console.log('\n4. 🔍 Verificando si la ruta exists...');
    
    // Leer el archivo de rutas
    const fs = require('fs');
    const routesPath = 'backend/routes/quotations.js';
    
    try {
        const routesContent = fs.readFileSync(routesPath, 'utf8');
        
        if (routesContent.includes('process-natural-order')) {
            console.log('✅ Ruta process-natural-order encontrada en quotations.js');
        } else {
            console.log('❌ Ruta process-natural-order NO encontrada en quotations.js');
        }
        
        if (routesContent.includes('processNaturalLanguageOrder')) {
            console.log('✅ Método processNaturalLanguageOrder referenciado');
        } else {
            console.log('❌ Método processNaturalLanguageOrder NO referenciado');
        }
        
    } catch (error) {
        console.log('❌ No se pudo leer el archivo de rutas');
    }
}

debugError500();
