const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testChatGptProductIdentification() {
    console.log('🧪 Test de identificación de productos con ChatGPT\n');

    try {
        // 1. Login
        console.log('🔐 1. Iniciando sesión...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Sesión iniciada correctamente\n');

        // 2. Test various product identification scenarios
        const testCases = [
            {
                name: 'Producto con código explícito',
                text: 'Necesito 2 unidades del producto IMPLE04'
            },
            {
                name: 'Producto con código y descripción',
                text: 'Quiero comprar 3 implementos código IMPLE04 para mi negocio'
            },
            {
                name: 'Múltiples productos',
                text: 'Necesito 2 IMPLE04 y 1 LIQUIPP07'
            },
            {
                name: 'Producto con precio',
                text: 'Quiero 1 implemento IMPLE04 a precio de mercado'
            }
        ];

        for (const testCase of testCases) {
            console.log(`🤖 Probando: ${testCase.name}`);
            console.log(`📝 Texto: "${testCase.text}"`);

            try {
                const response = await axios.post(
                    `${API_BASE}/quotations/process-natural-order`,
                    {
                        customer_id: 74, // ID del cliente JOHN EDISSON CAICEDO BENAVIDES
                        natural_language_order: testCase.text
                    },
                    {
                        headers: { 'Authorization': `Bearer ${token}` },
                        timeout: 30000
                    }
                );

                console.log('✅ Respuesta recibida:');
                console.log(`   - Items detectados: ${response.data.data?.structured_items?.length || 0}`);
                console.log(`   - Confianza: ${response.data.data?.average_confidence || 'N/A'}`);
                
                if (response.data.data?.structured_items && response.data.data.structured_items.length > 0) {
                    response.data.data.structured_items.forEach((item, index) => {
                        console.log(`   - Item ${index + 1}:`);
                        console.log(`     * Código: ${item.product_code || 'N/A'}`);
                        console.log(`     * Descripción: ${item.product_name || 'N/A'}`);
                        console.log(`     * Cantidad: ${item.quantity || 'N/A'}`);
                        console.log(`     * Precio: ${item.unit_price || 'N/A'}`);
                        console.log(`     * Confianza: ${item.confidence_score || 'N/A'}`);
                    });
                } else {
                    console.log('   ❌ No se detectaron items');
                }

                console.log(`   - Respuesta completa: ${JSON.stringify(response.data, null, 2)}`);
                
            } catch (error) {
                console.log(`❌ Error en caso "${testCase.name}":`, error.response?.data?.message || error.message);
            }
            
            console.log('---');
        }

        console.log('\n📊 Resumen del test:');
        console.log('Se probaron diferentes formatos de texto para verificar');
        console.log('que ChatGPT puede identificar correctamente los productos.');

    } catch (error) {
        console.error('❌ Error general en el test:', error.response?.data || error.message);
    }
}

testChatGptProductIdentification();
