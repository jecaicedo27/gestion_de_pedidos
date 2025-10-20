const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testChatGPTProcessing() {
    console.log('🧪 Test del procesamiento con ChatGPT con cliente\n');
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

        // 2. Buscar un cliente válido
        console.log('\n2️⃣ Buscando cliente de prueba...');
        const customersResponse = await axios.get(`${API_URL}/customers/search?search=droguer`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        let customerId;
        if (customersResponse.data.customers && customersResponse.data.customers.length > 0) {
            customerId = customersResponse.data.customers[0].id;
            console.log(`✅ Cliente encontrado: ${customersResponse.data.customers[0].commercial_name} (ID: ${customerId})`);
        } else {
            // Si no encuentra, usar un ID conocido
            customerId = 1; // ID por defecto para pruebas
            console.log(`⚠️ No se encontró cliente, usando ID por defecto: ${customerId}`);
        }

        // 3. Procesar con ChatGPT
        console.log('\n3️⃣ Procesando con ChatGPT...');
        const pedidoNatural = "2 sal limon x 250\n3 perlas de fresa x 350";
        console.log('📝 Pedido de prueba:');
        console.log(`   Cliente ID: ${customerId}`);
        console.log(`   Pedido: ${pedidoNatural}`);

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
                }
            }
        );

        console.log('\n✅ Procesamiento exitoso!');
        console.log('Respuesta de ChatGPT:');
        console.log(JSON.stringify(chatGPTResponse.data, null, 2));

        // 4. Verificar si se creó la cotización
        if (chatGPTResponse.data.quotation) {
            console.log('\n📋 Cotización creada:');
            console.log(`   ID: ${chatGPTResponse.data.quotation.id}`);
            console.log(`   Total: $${chatGPTResponse.data.quotation.total_amount}`);
            console.log(`   Productos: ${chatGPTResponse.data.quotation.items?.length || 0}`);
        }

        // 5. Verificar interpretación de productos
        if (chatGPTResponse.data.interpretedOrder) {
            console.log('\n🛒 Interpretación del pedido:');
            chatGPTResponse.data.interpretedOrder.forEach(item => {
                console.log(`   - ${item.quantity}x ${item.product_name || item.product_code} @ $${item.unit_price} = $${item.total_price}`);
            });
        }

        console.log('\n✅ ¡Test completado exitosamente!');
        console.log('\n📊 Resumen:');
        console.log('   - Login: ✅');
        console.log('   - Cliente encontrado: ✅');
        console.log('   - Procesamiento ChatGPT: ✅');
        console.log('   - Cotización creada: ' + (chatGPTResponse.data.quotation ? '✅' : '⚠️'));

    } catch (error) {
        console.error('\n❌ Error en la prueba:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
            
            // Mostrar más detalles del error si están disponibles
            if (error.response.data.details) {
                console.error('\n📋 Detalles del error:');
                console.error(JSON.stringify(error.response.data.details, null, 2));
            }
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Ejecutar el test
testChatGPTProcessing();
