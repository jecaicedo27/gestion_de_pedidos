const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testChatGPT() {
    try {
        // 1. Login
        console.log('=== INICIANDO SESIÓN ===');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso\n');
        
        // 2. Obtener un cliente de prueba
        console.log('=== OBTENIENDO CLIENTE ===');
        const customersResponse = await axios.get(`${API_URL}/customers`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { search: '1082746400' }
        });
        
        const customer = customersResponse.data.data[0];
        console.log(`Cliente: ${customer.name} (ID: ${customer.id})\n`);
        
        // 3. Procesar pedido con ChatGPT - Usando el formato correcto
        console.log('=== PROCESANDO PEDIDO CON CHATGPT ===');
        const pedido = "3 sal limon x 250\n6 perlas de fresa x 350";
        console.log(`Pedido a procesar: "${pedido}"\n`);
        
        const chatGPTResponse = await axios.post(
            `${API_URL}/quotations/process-natural-order`,
            {
                customer_id: customer.id,
                natural_language_order: pedido
            },
            {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('=== RESPUESTA DE CHATGPT ===');
        console.log('Success:', chatGPTResponse.data.success);
        console.log('Message:', chatGPTResponse.data.message);
        
        if (chatGPTResponse.data.data) {
            console.log('\n📦 PRODUCTOS IDENTIFICADOS:');
            if (chatGPTResponse.data.data.structured_items && chatGPTResponse.data.data.structured_items.length > 0) {
                chatGPTResponse.data.data.structured_items.forEach((item, index) => {
                    console.log(`\n${index + 1}. ${item.product_name}`);
                    console.log(`   - Cantidad: ${item.quantity}`);
                    console.log(`   - Precio unitario: $${item.unit_price}`);
                    console.log(`   - Total: $${item.total}`);
                    if (item.product_id) {
                        console.log(`   - ID producto: ${item.product_id}`);
                    }
                });
                
                console.log(`\n💰 TOTAL COTIZACIÓN: $${chatGPTResponse.data.data.total}`);
            } else {
                console.log('❌ No se identificaron productos');
                console.log('\nRespuesta completa de data:');
                console.log(JSON.stringify(chatGPTResponse.data.data, null, 2));
            }
            
            if (chatGPTResponse.data.data.processing_time_ms) {
                console.log(`\n⏱️ Tiempo de procesamiento: ${chatGPTResponse.data.data.processing_time_ms}ms`);
            }
            
            if (chatGPTResponse.data.data.tokens_used) {
                console.log(`📊 Tokens usados: ${chatGPTResponse.data.data.tokens_used}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        if (error.response?.data?.details) {
            console.error('Detalles:', error.response.data.details);
        }
    }
}

testChatGPT();
