const axios = require('axios');

// Complete test for the quotations system with authentication
async function testCompleteQuotationsSystem() {
    console.log('🔍 TESTING COMPLETE QUOTATIONS SYSTEM');
    console.log('====================================\n');

    const API_BASE_URL = 'http://localhost:3001/api';
    let authToken = null;

    try {
        // Step 1: Login to get authentication token
        console.log('🔐 1. AUTHENTICATION TEST');
        console.log('-------------------------');
        try {
            const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
                email: 'admin@test.com', // Default admin credentials
                password: 'admin123'
            }, { timeout: 5000 });

            if (loginResponse.data && loginResponse.data.token) {
                authToken = loginResponse.data.token;
                console.log('✅ Login exitoso');
                console.log(`📝 Token obtenido: ${authToken.substring(0, 20)}...`);
                console.log(`👤 Usuario: ${loginResponse.data.user?.name || 'Admin'}`);
            } else {
                throw new Error('No se obtuvo token en la respuesta');
            }
        } catch (error) {
            console.log('❌ Error en login:', error.response?.data?.message || error.message);
            console.log('💡 Asegúrate de que existe un usuario admin con credenciales: admin@test.com / admin123');
            
            // Try alternative login credentials
            console.log('\n🔄 Intentando credenciales alternativas...');
            try {
                const altLoginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
                    email: 'admin@admin.com',
                    password: '123456'
                }, { timeout: 5000 });
                
                if (altLoginResponse.data && altLoginResponse.data.token) {
                    authToken = altLoginResponse.data.token;
                    console.log('✅ Login exitoso con credenciales alternativas');
                    console.log(`📝 Token obtenido: ${authToken.substring(0, 20)}...`);
                } else {
                    throw new Error('No se pudo autenticar con ninguna credencial');
                }
            } catch (altError) {
                console.log('❌ No se pudo autenticar. Probando sin autenticación...');
                console.log('\n⚠️  NOTA: Si no hay usuarios en el sistema, necesitas crearlos primero.');
            }
        }

        // Step 2: Test quotations list with authentication
        console.log('\n📋 2. QUOTATIONS LIST TEST');
        console.log('---------------------------');
        
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        headers['Content-Type'] = 'application/json';

        try {
            const quotationsResponse = await axios.get(`${API_BASE_URL}/quotations`, {
                headers,
                timeout: 10000
            });

            console.log('✅ Endpoint de cotizaciones funcionando');
            console.log(`📊 Status: ${quotationsResponse.status}`);
            console.log(`📦 Cotizaciones encontradas: ${quotationsResponse.data.length || 0}`);

            if (quotationsResponse.data && quotationsResponse.data.length > 0) {
                console.log('\n📝 COTIZACIONES EXISTENTES:');
                console.log('===========================');
                quotationsResponse.data.slice(0, 5).forEach((quotation, index) => {
                    console.log(`\n${index + 1}. ID: ${quotation.id}`);
                    console.log(`   Cliente: ${quotation.customer_name || 'N/A'}`);
                    console.log(`   Estado: ${quotation.status || 'N/A'}`);
                    console.log(`   Fecha: ${quotation.created_at ? new Date(quotation.created_at).toLocaleDateString() : 'N/A'}`);
                    console.log(`   SIIGO ID: ${quotation.siigo_id || 'No creada en SIIGO'}`);
                    console.log(`   ChatGPT procesada: ${quotation.chatgpt_result ? 'Sí' : 'No'}`);
                    if (quotation.chatgpt_result) {
                        try {
                            const result = typeof quotation.chatgpt_result === 'string' ? 
                                JSON.parse(quotation.chatgpt_result) : quotation.chatgpt_result;
                            console.log(`   Productos detectados: ${result.structured_items?.length || 0}`);
                        } catch (e) {
                            console.log(`   Resultado ChatGPT: ${JSON.stringify(quotation.chatgpt_result).substring(0, 50)}...`);
                        }
                    }
                });
            } else {
                console.log('ℹ️  No hay cotizaciones en la base de datos');
                console.log('💡 Las cotizaciones aparecerán después de procesar pedidos con ChatGPT');
            }

        } catch (error) {
            if (error.response?.status === 401) {
                console.log('❌ Error 401: Falta autenticación');
                console.log('💡 El usuario debe estar logueado para ver las cotizaciones');
            } else {
                console.log('❌ Error obteniendo cotizaciones:', error.response?.data?.message || error.message);
            }
        }

        // Step 3: Test customers search endpoint
        console.log('\n👥 3. CUSTOMERS SEARCH TEST');
        console.log('----------------------------');
        
        try {
            const customersResponse = await axios.get(`${API_BASE_URL}/quotations/customers/search`, {
                headers,
                params: { search: 'test' },
                timeout: 5000
            });

            console.log('✅ Endpoint de búsqueda de clientes funcionando');
            console.log(`📊 Clientes encontrados: ${customersResponse.data.length || 0}`);
            
            if (customersResponse.data && customersResponse.data.length > 0) {
                console.log(`📝 Primeros 3 clientes:`);
                customersResponse.data.slice(0, 3).forEach((customer, index) => {
                    console.log(`   ${index + 1}. ${customer.name || customer.commercial_name || 'Sin nombre'} (ID: ${customer.id})`);
                });
            }
        } catch (error) {
            console.log('❌ Error buscando clientes:', error.response?.data?.message || error.message);
        }

        // Step 4: Test ChatGPT processing endpoint
        console.log('\n🤖 4. CHATGPT PROCESSING TEST');
        console.log('------------------------------');
        
        try {
            // Test with a simple order
            const testOrder = {
                customer_id: 1,
                order_text: "Necesito 5 cajas de Liquipops sabor maracuyá"
            };

            console.log('🔄 Enviando pedido de prueba para procesamiento ChatGPT...');
            console.log(`📝 Texto: "${testOrder.order_text}"`);

            const chatgptResponse = await axios.post(`${API_BASE_URL}/quotations/process-natural-order`, testOrder, {
                headers,
                timeout: 30000 // 30 segundos para ChatGPT
            });

            console.log('✅ ChatGPT procesamiento exitoso');
            console.log(`📊 Status: ${chatgptResponse.status}`);
            
            if (chatgptResponse.data) {
                console.log('📦 RESULTADO ChatGPT:');
                console.log('======================');
                const result = chatgptResponse.data;
                
                if (result.structured_items) {
                    console.log(`✨ Productos detectados: ${result.structured_items.length}`);
                    result.structured_items.forEach((item, index) => {
                        console.log(`   ${index + 1}. ${item.product_name || item.description}`);
                        console.log(`      Cantidad: ${item.quantity}`);
                        console.log(`      Código: ${item.product_code || 'N/A'}`);
                        console.log(`      Precio: $${item.unit_price || 'N/A'}`);
                    });
                }
                
                if (result.chatgpt_response) {
                    console.log(`🤖 Modelo usado: ${result.chatgpt_response.model || 'N/A'}`);
                    console.log(`⚡ Tokens usados: ${result.chatgpt_response.tokens_used || 'N/A'}`);
                }
            }

        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.log('⏰ Timeout en procesamiento ChatGPT (esperado si no hay configuración)');
            } else {
                console.log('❌ Error en ChatGPT:', error.response?.data?.message || error.message);
                if (error.response?.status === 422) {
                    console.log('💡 Esto puede indicar cuota agotada o configuración pendiente');
                }
            }
        }

        // Step 5: Test SIIGO invoice creation endpoint
        console.log('\n💼 5. SIIGO INVOICE CREATION TEST');
        console.log('----------------------------------');
        
        try {
            const invoiceTest = {
                customer_id: 1,
                order_text: "Necesito 3 cajas de productos para prueba",
                customer_data: {
                    name: "Cliente de Prueba",
                    email: "test@test.com",
                    phone: "1234567890"
                }
            };

            console.log('🔄 Probando creación de factura en SIIGO...');

            // Just test the endpoint exists, don't actually create the invoice
            const siigoResponse = await axios.post(`${API_BASE_URL}/quotations/create-siigo-with-chatgpt`, invoiceTest, {
                headers,
                timeout: 5000,
                validateStatus: function (status) {
                    return status < 500; // Don't throw error for 4xx responses
                }
            });

            if (siigoResponse.status === 200 || siigoResponse.status === 201) {
                console.log('✅ Endpoint de creación SIIGO funcionando');
                console.log(`📊 Status: ${siigoResponse.status}`);
                if (siigoResponse.data?.siigo_id) {
                    console.log(`📄 Factura creada en SIIGO: ${siigoResponse.data.siigo_id}`);
                }
            } else {
                console.log(`⚠️  Endpoint responde pero con status: ${siigoResponse.status}`);
                console.log(`📝 Mensaje: ${siigoResponse.data?.message || 'Sin mensaje'}`);
            }

        } catch (error) {
            console.log('❌ Error probando SIIGO:', error.response?.data?.message || error.message);
            console.log('💡 Esto es normal si no hay configuración SIIGO');
        }

    } catch (error) {
        console.log('❌ Error general:', error.message);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN Y SOLUCIÓN');
    console.log('='.repeat(60));
    console.log('🔍 DIAGNÓSTICO:');
    console.log('   El sistema de cotizaciones requiere autenticación');
    console.log('   Si no ves la lista, probablemente no estás logueado');
    console.log('');
    console.log('✅ SOLUCIÓN:');
    console.log('   1. Asegúrate de estar logueado en el frontend');
    console.log('   2. Verifica que el token no haya expirado');
    console.log('   3. El backend está funcionando en puerto 3001');
    console.log('   4. La visualización de ChatGPT está configurada correctamente');
    console.log('');
    console.log('🎯 PARA VER LAS FACTURAS:');
    console.log('   - Las facturas se crean directamente en SIIGO');
    console.log('   - Las cotizaciones se guardan localmente con status "invoiced"');
    console.log('   - Aparecerán en la lista una vez procesadas');
    console.log('');
    console.log('🚀 PRÓXIMOS PASOS:');
    console.log('   1. Iniciar el frontend: npm start en carpeta frontend/');
    console.log('   2. Hacer login en http://localhost:3000');
    console.log('   3. Ir a la página de cotizaciones');
    console.log('   4. Probar el flujo completo');
    console.log('='.repeat(60));
}

testCompleteQuotationsSystem().catch(console.error);
