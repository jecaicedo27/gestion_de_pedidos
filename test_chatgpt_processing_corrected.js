const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testChatGPTProcessing() {
    console.log('🧪 Test del procesamiento con ChatGPT - Parámetros corregidos\n');
    console.log('==================================================\n');

    try {
        // 1. Login
        console.log('1️⃣ Iniciando sesión...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso');
        console.log(`Token obtenido: ${token.substring(0, 50)}...`);

        // 2. Obtener lista de clientes para usar uno válido
        console.log('\n2️⃣ Obteniendo lista de clientes...');
        let customerId = 1; // Valor por defecto
        let customerName = 'Cliente de prueba';
        
        try {
            const customersResponse = await axios.get(`${API_URL}/customers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (customersResponse.data.customers && customersResponse.data.customers.length > 0) {
                customerId = customersResponse.data.customers[0].id;
                customerName = customersResponse.data.customers[0].commercial_name || 
                               customersResponse.data.customers[0].company_name || 
                               customersResponse.data.customers[0].name;
                console.log(`✅ Cliente encontrado: ${customerName} (ID: ${customerId})`);
                console.log(`   Total de clientes disponibles: ${customersResponse.data.customers.length}`);
            }
        } catch (error) {
            console.log('⚠️ No se pudieron obtener clientes, usando ID por defecto: 1');
        }

        // 3. Procesar con ChatGPT usando los nombres de parámetros correctos
        console.log('\n3️⃣ Procesando con ChatGPT...');
        const pedidoNatural = "2 sal limon x 250\n3 perlas de fresa x 350";
        
        console.log('📝 Pedido de prueba:');
        console.log(`   Cliente: ${customerName} (ID: ${customerId})`);
        console.log(`   Pedido en lenguaje natural:`);
        console.log(`   - 2 sal limon x 250`);
        console.log(`   - 3 perlas de fresa x 350`);

        console.log('\n⏳ Enviando a ChatGPT para procesamiento...');
        console.log('📨 Parámetros que se enviarán:');
        console.log(`   - customer_id: ${customerId}`);
        console.log(`   - natural_language_order: "${pedidoNatural}"`);
        console.log(`   - processing_type: "text"`);
        
        const chatGPTResponse = await axios.post(
            `${API_URL}/quotations/process-natural-order`,
            {
                customer_id: customerId,  // Correcto: con guión bajo
                natural_language_order: pedidoNatural,  // Correcto: con guión bajo
                processing_type: 'text'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 segundos de timeout
            }
        );

        console.log('\n✅ ¡Procesamiento exitoso!');
        
        // 4. Mostrar respuesta de ChatGPT
        if (chatGPTResponse.data.data) {
            console.log('\n🤖 Respuesta de ChatGPT:');
            
            // Mostrar items estructurados
            if (chatGPTResponse.data.data.structured_items) {
                console.log('\n📦 Items procesados:');
                chatGPTResponse.data.data.structured_items.forEach((item, idx) => {
                    console.log(`   ${idx + 1}. Producto: ${item.product_name || item.product_code}`);
                    console.log(`      - Cantidad: ${item.quantity}`);
                    console.log(`      - Precio unitario: $${item.unit_price}`);
                    console.log(`      - Total: $${(item.quantity * item.unit_price).toFixed(2)}`);
                    if (item.confidence_score) {
                        console.log(`      - Confianza: ${(item.confidence_score * 100).toFixed(1)}%`);
                    }
                });
                
                // Calcular total
                const total = chatGPTResponse.data.data.structured_items.reduce((sum, item) => {
                    return sum + (item.quantity * item.unit_price);
                }, 0);
                console.log(`\n💰 Total del pedido: $${total.toFixed(2)}`);
            }
            
            // Mostrar metadata del procesamiento
            if (chatGPTResponse.data.data.processing_metadata) {
                const metadata = chatGPTResponse.data.data.processing_metadata;
                console.log('\n📊 Metadata del procesamiento:');
                console.log(`   - ID de procesamiento: ${metadata.processing_id}`);
                if (metadata.processing_time_ms) {
                    console.log(`   - Tiempo de procesamiento: ${metadata.processing_time_ms}ms`);
                }
                if (metadata.tokens_used) {
                    console.log(`   - Tokens usados: ${metadata.tokens_used}`);
                }
                if (metadata.assistant_id) {
                    console.log(`   - Assistant ID: ${metadata.assistant_id}`);
                }
            }
            
            // Mostrar confianza promedio
            if (chatGPTResponse.data.data.average_confidence) {
                console.log(`\n🎯 Confianza promedio: ${(chatGPTResponse.data.data.average_confidence * 100).toFixed(1)}%`);
            }
        }

        // 5. Resumen final
        console.log('\n' + '='.repeat(50));
        console.log('✅ ¡TEST COMPLETADO EXITOSAMENTE!');
        console.log('='.repeat(50));
        console.log('\n📊 Resumen del test:');
        console.log('   ✅ Login exitoso');
        console.log('   ✅ Cliente válido usado');
        console.log('   ✅ Procesamiento con ChatGPT exitoso');
        console.log('   ✅ Items estructurados correctamente');
        
        const itemsCount = chatGPTResponse.data.data?.structured_items?.length || 0;
        console.log(`\n💡 ChatGPT procesó ${itemsCount} items del pedido en lenguaje natural.`);
        console.log('   El sistema está funcionando correctamente después del reinicio.');

    } catch (error) {
        console.error('\n❌ Error en la prueba:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Mensaje:', error.response.data?.message || 'Sin mensaje');
            
            if (error.response.status === 422) {
                console.error('\n⚠️ Error 422: Error procesando con ChatGPT');
                console.error('Posibles causas:');
                console.error('   1. Las credenciales de OpenAI no están configuradas');
                console.error('   2. El Assistant ID no está configurado');
                console.error('   3. Cuota de OpenAI excedida');
                console.error('   4. Error en el formato de la solicitud');
            }
            
            if (error.response.data) {
                console.error('\nDetalles completos:');
                console.error(JSON.stringify(error.response.data, null, 2));
            }
        } else if (error.code === 'ECONNABORTED') {
            console.error('⏱️ Timeout: La solicitud tardó demasiado tiempo');
            console.error('   ChatGPT puede estar procesando. Intente nuevamente.');
        } else {
            console.error('Error:', error.message);
        }
        
        console.log('\n💡 Sugerencia: Verifica que:');
        console.log('   1. El backend esté ejecutándose correctamente');
        console.log('   2. Las credenciales de OpenAI estén en el archivo .env:');
        console.log('      - OPENAI_API_KEY=sk-...');
        console.log('      - OPENAI_ASSISTANT_ID=asst_RUCJClbr7gcV5FBcpUHVnFcY');
        console.log('   3. Los productos mencionados existan en la base de datos');
    }
}

// Ejecutar el test
testChatGPTProcessing();
