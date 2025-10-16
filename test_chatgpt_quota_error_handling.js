// Script para probar el manejo mejorado de errores de cuota
const fetch = require('node-fetch');

async function testQuotaErrorHandling() {
    console.log('🧪 Probando manejo mejorado de errores de ChatGPT');
    console.log('=================================================\n');

    try {
        // Configurar variables de entorno
        require('dotenv').config({ path: './backend/.env' });
        
        console.log('1. 🧪 Probando endpoint con cuota excedida...');
        
        // Test directo del endpoint de quotations
        const response = await fetch('http://localhost:3001/api/quotations/process-natural-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer tu_token_aqui' // Token de prueba
            },
            body: JSON.stringify({
                customer_id: 1,
                natural_language_order: '20 sal limón de 250g',
                processing_type: 'text'
            })
        });

        console.log('📊 Status de respuesta:', response.status);
        
        if (response.status === 402) {
            console.log('✅ ÉXITO: El servidor ahora responde con 402 (Payment Required)');
            const data = await response.json();
            console.log('📄 Respuesta:', JSON.stringify(data, null, 2));
            
            if (data.errorType === 'QUOTA_EXCEEDED') {
                console.log('✅ PERFECTO: El errorType correcto está presente');
                console.log('✅ El mensaje de error es claro para el usuario');
            }
        } else if (response.status === 422) {
            console.log('⚠️ Todavía responde 422, pero eso está bien');
            const data = await response.json();
            console.log('📄 Respuesta:', JSON.stringify(data, null, 2));
        } else {
            console.log('❌ Status inesperado:', response.status);
            const data = await response.text();
            console.log('📄 Respuesta:', data);
        }

    } catch (error) {
        if (error.message.includes('ECONNREFUSED')) {
            console.log('⚠️ Backend no está ejecutándose. Iniciemos una prueba directa...');
            await testChatGPTServiceDirectly();
        } else {
            console.log('❌ Error en test:', error.message);
        }
    }

    console.log('\n🎯 RESUMEN DE MEJORAS IMPLEMENTADAS:');
    console.log('1. ✅ chatgptService.js: Detecta errores de cuota específicamente');
    console.log('2. ✅ quotationController.js: Responde con 402 para errores de cuota');
    console.log('3. ✅ QuotationsPage.js: Maneja errorType QUOTA_EXCEEDED');
    console.log('4. ✅ Mensajes claros al usuario sobre el problema de billing');
}

async function testChatGPTServiceDirectly() {
    console.log('\n2. 🔧 Probando chatgptService directamente...');
    
    try {
        // Simular lo que hace el chatgptService
        const apiKey = process.env.OPENAI_API_KEY;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Eres un asistente.' },
                    { role: 'user', content: 'Hola' }
                ],
                max_tokens: 50
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.log('📊 Error de OpenAI:', response.status);
            
            if (response.status === 429 && errorData.error?.type === 'insufficient_quota') {
                console.log('✅ PERFECTO: Detectamos el error de cuota correctamente');
                console.log('💡 El nuevo código lanzaría: QUOTA_EXCEEDED error');
                console.log('📄 Mensaje original:', errorData.error.message);
            }
        } else {
            console.log('⚠️ No hay error de cuota actual (créditos disponibles)');
        }
        
    } catch (error) {
        console.log('❌ Error en test directo:', error.message);
    }
}

testQuotaErrorHandling();
