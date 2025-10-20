const axios = require('axios');

async function debugFV1Error() {
    console.log('=== Debug Error 422 Factura FV-1 desde Frontend ===\n');

    try {
        // 1. Login
        console.log('1. Realizando login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso');

        // 2. Obtener cotizaciones existentes
        console.log('\n2. Obteniendo cotizaciones existentes...');
        const quotationsResponse = await axios.get('http://localhost:3001/api/quotations', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ ${quotationsResponse.data.data.length} cotizaciones encontradas`);
        
        // Encontrar la cotización con los productos que veo en la imagen
        const targetQuotation = quotationsResponse.data.data.find(q => 
            q.notes && q.notes.includes('sal limon') && q.notes.includes('perlas')
        );

        if (targetQuotation) {
            console.log(`\n3. Cotización encontrada - ID: ${targetQuotation.id}`);
            console.log('Detalles:', JSON.stringify(targetQuotation, null, 2));

            // 4. Intentar crear factura usando el mismo endpoint que usa el frontend
            console.log('\n4. Intentando crear factura FV-1...');
            
            try {
                const invoiceResponse = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
                    quotationId: targetQuotation.id,
                    documentType: 'FV-1'
                }, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log('✅ Factura creada exitosamente');
                console.log('Respuesta:', JSON.stringify(invoiceResponse.data, null, 2));

            } catch (invoiceError) {
                console.log('❌ Error 422 detectado:');
                console.log('Status:', invoiceError.response?.status);
                console.log('Error completo:', JSON.stringify(invoiceError.response?.data, null, 2));
                
                // 5. Analizar qué está causando el error
                if (invoiceError.response?.status === 422) {
                    console.log('\n🔍 ANÁLISIS DEL ERROR 422:');
                    
                    // Verificar si es problema con el customer
                    console.log('- Customer ID:', targetQuotation.customer_id);
                    
                    // Verificar productos
                    console.log('- Número de items:', targetQuotation.items?.length || 0);
                    if (targetQuotation.items) {
                        targetQuotation.items.forEach((item, index) => {
                            console.log(`  Item ${index + 1}:`, {
                                product_id: item.product_id,
                                quantity: item.quantity,
                                price: item.price,
                                product_name: item.product_name
                            });
                        });
                    }

                    // 6. Verificar endpoint alternativo (el que usábamos antes)
                    console.log('\n6. Probando endpoint alternativo...');
                    try {
                        const altInvoiceResponse = await axios.post(`http://localhost:3001/api/quotations/${targetQuotation.id}/process`, {
                            action: 'create_invoice',
                            document_type: 'FV-1'
                        }, {
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        console.log('✅ Endpoint alternativo funcionó!');
                        console.log('Respuesta:', JSON.stringify(altInvoiceResponse.data, null, 2));

                    } catch (altError) {
                        console.log('❌ Endpoint alternativo también falló:');
                        console.log('Status:', altError.response?.status);
                        console.log('Error:', JSON.stringify(altError.response?.data, null, 2));
                    }
                }
            }

        } else {
            // Si no encuentra la cotización, crear una nueva para testing
            console.log('\n3. No se encontró cotización específica, creando una nueva...');
            
            const testQuotation = {
                customer_id: 1,
                items: [
                    { product_id: 1, quantity: 2, price: 2500, product_name: 'sal limon de 250' },
                    { product_id: 2, quantity: 6, price: 3500, product_name: 'perlas de cereza x 350' }
                ],
                notes: 'Cotización test para debug error 422 FV-1'
            };

            const newQuotationResponse = await axios.post('http://localhost:3001/api/quotations', testQuotation, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const quotationId = newQuotationResponse.data.data.id;
            console.log(`✅ Nueva cotización creada - ID: ${quotationId}`);

            // Probar crear factura con la nueva cotización
            try {
                const invoiceResponse = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
                    quotationId: quotationId,
                    documentType: 'FV-1'
                }, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log('✅ Factura creada con nueva cotización');

            } catch (newInvoiceError) {
                console.log('❌ Error con nueva cotización también:');
                console.log('Status:', newInvoiceError.response?.status);
                console.log('Error:', JSON.stringify(newInvoiceError.response?.data, null, 2));
            }
        }

        console.log('\n=== Debug completado ===');

    } catch (error) {
        console.error('❌ Error general:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
    }
}

debugFV1Error();
