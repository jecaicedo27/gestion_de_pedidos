// Script para debugear el error 422 de ChatGPT
const fetch = require('node-fetch');

async function debugChatGPTError() {
    console.log('🐛 Debugging ChatGPT Error 422');
    console.log('==================================\n');

    // Verificar configuración básica
    console.log('1. ✅ Verificando configuración...');
    
    try {
        // Verificar variables de entorno
        require('dotenv').config({ path: './backend/.env' });
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            console.log('❌ Error: OPENAI_API_KEY no está configurada en .env');
            console.log('   Solución: Agregar OPENAI_API_KEY=tu_clave_aqui en el archivo .env');
            return;
        }
        
        console.log('✅ API Key configurada:', apiKey.substring(0, 20) + '...');

        // Verificar que node-fetch está disponible
        console.log('✅ node-fetch disponible');

        // Test simple de ChatGPT
        console.log('\n2. 🧪 Probando conexión simple con ChatGPT...');
        
        const simpleTest = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { 
                        role: 'system', 
                        content: 'Eres un asistente que procesa pedidos. Responde siempre en formato JSON válido.' 
                    },
                    { 
                        role: 'user', 
                        content: 'Procesa este pedido: "20 sal limón de 250". Responde en JSON con items:[{product_name, quantity, unit, confidence}]' 
                    }
                ],
                temperature: 0.1,
                max_tokens: 500,
                response_format: { type: "json_object" }
            })
        });

        if (simpleTest.ok) {
            const data = await simpleTest.json();
            console.log('✅ Conexión exitosa con ChatGPT');
            console.log('📄 Respuesta:', data.choices[0].message.content.substring(0, 200) + '...');
            console.log('📊 Tokens usados:', data.usage.total_tokens);
            
            console.log('\n🎯 SOLUCIÓN ENCONTRADA:');
            console.log('El error 422 probablemente se debe a un problema de configuración.');
            console.log('ChatGPT está funcionando correctamente.');
            
        } else {
            const errorData = await simpleTest.json();
            console.log('❌ Error en conexión:', simpleTest.status);
            console.log('📄 Detalle:', JSON.stringify(errorData, null, 2));
            
            if (simpleTest.status === 401) {
                console.log('\n🔑 PROBLEMA: Clave de API inválida');
                console.log('Solución: Verificar que la clave en .env sea correcta');
            } else if (simpleTest.status === 429) {
                console.log('\n⏰ PROBLEMA: Límite de rate excedido');
                console.log('Solución: Esperar un momento e intentar nuevamente');
            } else {
                console.log('\n🔧 PROBLEMA: Error de configuración');
                console.log('Solución: Revisar configuración de ChatGPT');
            }
        }

    } catch (error) {
        console.log('❌ Error en debug:', error.message);
        
        if (error.message.includes('fetch is not defined')) {
            console.log('\n📦 PROBLEMA: node-fetch no instalado');
            console.log('Solución: npm install node-fetch');
        } else if (error.message.includes('Cannot find module')) {
            console.log('\n📦 PROBLEMA: Dependencias faltantes');
            console.log('Solución: npm install');
        }
    }
    
    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('1. Asegurar que OPENAI_API_KEY está en .env');
    console.log('2. Verificar que node-fetch está instalado');
    console.log('3. Simplificar el servicio ChatGPT si es necesario');
    console.log('4. Reiniciar el servidor backend');
}

debugChatGPTError();
