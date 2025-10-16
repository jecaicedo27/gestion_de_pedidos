const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testChatGPTProcessing() {
    console.log('🧪 Test del procesamiento con ChatGPT con cliente existente\n');
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

        // 2. Obtener lista de clientes
        console.log('\n2️⃣ Obteniendo lista de clientes...');
        let customerId;
        let customerName;
        
        try {
            // Intentar obtener todos los clientes
            const customersResponse = await axios.get(`${API_URL}/customers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (customersResponse.data.customers && customersResponse.data.customers.length > 0) {
                // Usar el primer cliente disponible
                customerId = customersResponse.data.customers[0].id;
                customerName = customersResponse.data.customers[0].commercial_name || customersResponse.data.customers[0].company_name;
                console.log(`✅ Cliente encontrado: ${customerName} (ID: ${customerId})`);
                console.log(`Total de clientes disponibles: ${customersResponse.data.customers.length}`);
            }
        } catch (error) {
            console.log('⚠️ No se pudo obtener lista de clientes, usando ID por defecto');
            // Si falla, usar un ID conocido
            customerId = 1;
            customerName = 'Cliente de prueba';
        }

        if (!customerId) {
            console.log('⚠️ No hay clientes en la base de datos, usando ID 1 por defecto');
            customerId = 1;
            customerName = 'Cliente de prueba';
        }

        // 3. Procesar con ChatGPT
        console.log('\n3️⃣ Procesando con ChatGPT...');
        const pedidoNatural = "2 sal limon x 250\n3 perlas de fresa x 350";
        console.log('📝 Pedido de prueba:');
        console.log(`   Cliente: ${customerName} (ID: ${customerId})`);
        console.log(`   Pedido natural:`);
        console.log(`   - 2 sal limon x 250`);
        console.log(`   - 3 perlas de fresa x 350`);

        console.log('\n⏳ Enviando a ChatGPT para procesamiento...');
        
        const chatGPTResponse = await axios.post(
            `${API_URL}/quotations/process-natural-order`,
            {
                customerId: customerId,
                naturalLanguageOrder: pedidoNatural
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
        if (chatGPTResponse.data.chatGPTResponse) {
            console.log('\n🤖 Respuesta de ChatGPT:');
            console.log(JSON.stringify(chatGPTResponse.data.chatGPTResponse, null, 2));
        }

        // 5. Verificar si se creó la cotización
        if (chatGPTResponse.data.quotation) {
            console.log('\n📋 Cotización creada exitosamente:');
            console.log(`   ID: ${chatGPTResponse.data.quotation.id}`);
            console.log(`   Cliente: ${chatGPTResponse.data.quotation.customer_name || customerName}`);
            console.log(`   Total: $${chatGPTResponse.data.quotation.total_amount}`);
            console.log(`   Productos: ${chatGPTResponse.data.quotation.items?.length || 0}`);
            
            if (chatGPTResponse.data.quotation.items) {
                console.log('\n   Detalle de productos:');
                chatGPTResponse.data.quotation.items.forEach(item => {
                    console.log(`   - ${item.quantity}x ${item.product_name} @ $${item.unit_price} = $${item.total_price}`);
                });
            }
        }

        // 6. Verificar interpretación de productos
        if (chatGPTResponse.data.interpretedOrder) {
            console.log('\n🛒 Interpretación del pedido por ChatGPT:');
            chatGPTResponse.data.interpretedOrder.forEach(item => {
                console.log(`   - ${item.quantity}x ${item.product_name || item.product_code}`);
                console.log(`     Precio unitario: $${item.unit_price}`);
                console.log(`     Total: $${item.total_price}`);
                if (item.product_id) {
                    console.log(`     ID del producto: ${item.product_id}`);
                }
            });
        }

        // 7. Resumen final
        console.log('\n' + '='.repeat(50));
        console.log('✅ ¡TEST COMPLETADO EXITOSAMENTE!');
        console.log('='.repeat(50));
        console.log('\n📊 Resumen del test:');
        console.log('   ✅ Login exitoso');
        console.log('   ✅ Cliente encontrado/usado');
        console.log('   ✅ Procesamiento con ChatGPT exitoso');
        console.log('   ' + (chatGPTResponse.data.quotation ? '✅' : '⚠️') + ' Cotización creada');
        console.log('   ' + (chatGPTResponse.data.interpretedOrder ? '✅' : '⚠️') + ' Orden interpretada');
        
        console.log('\n💡 El procesamiento con ChatGPT está funcionando correctamente.');

    } catch (error) {
        console.error('\n❌ Error en la prueba:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Mensaje:', error.response.data?.message || 'Sin mensaje');
            console.error('Data completa:', JSON.stringify(error.response.data, null, 2));
            
            // Mostrar más detalles del error si están disponibles
            if (error.response.data?.details) {
                console.error('\n📋 Detalles del error:');
                console.error(JSON.stringify(error.response.data.details, null, 2));
            }
            if (error.response.data?.error) {
                console.error('\n⚠️ Error específico:', error.response.data.error);
            }
        } else if (error.code === 'ECONNABORTED') {
            console.error('⏱️ Timeout: La solicitud tardó demasiado tiempo');
        } else {
            console.error('Error:', error.message);
        }
        
        console.log('\n💡 Sugerencia: Verifica que:');
        console.log('   1. El backend esté ejecutándose correctamente');
        console.log('   2. Las credenciales de OpenAI estén configuradas en .env');
        console.log('   3. Los productos mencionados existan en la base de datos');
        console.log('   4. La tabla customers tenga al menos un registro');
    }
}

// Ejecutar el test
testChatGPTProcessing();
