const axios = require('axios');

async function testChatGPTWithTrainedProducts() {
    console.log('=== Test ChatGPT con productos entrenados ===\n');

    try {
        // 1. Login
        console.log('1. Realizando login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso');
        console.log(`Token obtenido (primeros 50 chars): ${token.substring(0, 50)}...`);

        // 2. Procesamiento ChatGPT con productos entrenados
        console.log('\n2. Procesando pedido con productos entrenados...');
        const chatgptResponse = await axios.post('http://localhost:3001/api/quotations/process-natural-order', {
            customer_id: 1,
            natural_language_order: '6 perlas de fresa x 350, 3 sal limon x 250'
        }, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ ChatGPT processing exitoso');
        console.log('Respuesta completa:', JSON.stringify(chatgptResponse.data, null, 2));
        console.log('\nProductos identificados:', chatgptResponse.data.data.structured_items.length);
        
        if (chatgptResponse.data.data.structured_items.length > 0) {
            console.log('\n✅ Productos encontrados:');
            chatgptResponse.data.data.structured_items.forEach((item, index) => {
                console.log(`${index + 1}. ${item.product_name} - Cantidad: ${item.quantity} - Precio: ${item.price || 'N/A'}`);
            });

            // 3. Crear cotización con los productos identificados
            console.log('\n3. Creando cotización con productos identificados...');
            const quotationData = {
                customer_id: 1,
                items: chatgptResponse.data.data.structured_items.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.price || 0,
                    product_name: item.product_name
                })),
                notes: `Pedido procesado con ChatGPT. ID: ${chatgptResponse.data.data.processing_metadata.processing_id}`
            };

            console.log('Datos de cotización:', JSON.stringify(quotationData, null, 2));

            const quotationResponse = await axios.post('http://localhost:3001/api/quotations', quotationData, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Cotización creada exitosamente');
            const quotationId = quotationResponse.data.data.id;
            console.log(`ID de cotización: ${quotationId}`);

            // 4. Intentar crear factura FV-1 desde la cotización
            console.log('\n4. Creando factura FV-1...');
            try {
                const invoiceResponse = await axios.post(`http://localhost:3001/api/quotations/${quotationId}/process`, {
                    action: 'create_invoice',
                    document_type: 'FV-1'
                }, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log('✅ Factura FV-1 creada exitosamente');
                console.log('Respuesta SIIGO:', JSON.stringify(invoiceResponse.data, null, 2));

            } catch (invoiceError) {
                console.log('❌ Error al crear factura FV-1:');
                console.log('Status:', invoiceError.response?.status);
                console.log('Error:', JSON.stringify(invoiceError.response?.data, null, 2));
                
                // Verificar si es el error 422 que esperamos resolver
                if (invoiceError.response?.status === 422) {
                    console.log('\n🔍 Error 422 detectado - este era el problema reportado');
                    console.log('Las correcciones del Document ID deberían haber resuelto esto');
                }
            }

        } else {
            console.log('❌ No se identificaron productos - verificar entrenamiento del assistant');
        }

        console.log('\n=== Test completado ===');

    } catch (error) {
        console.error('❌ Error en el test:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
    }
}

testChatGPTWithTrainedProducts();
