const axios = require('axios');

async function fixFrontendInvoiceParameters() {
    console.log('=== Fix Frontend Invoice Parameters - Error 422 ===\n');

    try {
        // 1. Login
        console.log('1. Realizando login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso');

        // 2. Crear cotización de prueba primero
        console.log('\n2. Creando cotización de prueba...');
        const quotationData = {
            customer_id: 1,
            items: [
                { product_name: '2 sal limon de 250', quantity: 2, unit_price: 2500 },
                { product_name: '6 perlas de cereza x 350', quantity: 6, unit_price: 3500 }
            ],
            notes: 'Pedido original: 2 sal limon de 250, 6 perlas de cereza x 350. Factura generada automáticamente desde sistema interno usando ChatGPT.'
        };

        const quotationResponse = await axios.post('http://localhost:3001/api/quotations', quotationData, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Cotización creada exitosamente');
        const quotationId = quotationResponse.data.data.id;
        console.log(`ID de cotización: ${quotationId}`);

        // 3. Probar el formato INCORRECTO que usa el frontend (causará error 422)
        console.log('\n3. Probando formato INCORRECTO del frontend...');
        try {
            const badResponse = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
                customerId: 1,        // ❌ Incorrecto - el backend espera customer_id
                items: quotationData.items,
                notes: quotationData.notes,
                documentType: 'FV-1'  // ❌ Incorrecto - el backend espera document_type
            }, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('❌ ERROR: El formato incorrecto no debería funcionar!');

        } catch (badError) {
            console.log('✅ Confirmado: Error 422 con formato incorrecto del frontend');
            console.log('Status:', badError.response?.status);
            console.log('Error:', JSON.stringify(badError.response?.data, null, 2));
        }

        // 4. Probar el formato CORRECTO
        console.log('\n4. Probando formato CORRECTO...');
        try {
            const goodResponse = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
                customer_id: 1,          // ✅ Correcto
                items: quotationData.items,
                notes: quotationData.notes,
                document_type: 'FV-1'    // ✅ Correcto
            }, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Factura FV-1 creada exitosamente con formato correcto!');
            console.log('Respuesta:', JSON.stringify(goodResponse.data, null, 2));

        } catch (goodError) {
            console.log('❌ Error aún con formato correcto:');
            console.log('Status:', goodError.response?.status);
            console.log('Error:', JSON.stringify(goodError.response?.data, null, 2));
        }

        // 5. Probar también con quotationId si el endpoint lo requiere
        console.log('\n5. Probando con quotation_id incluido...');
        try {
            const quotationResponse2 = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
                quotation_id: quotationId,   // Incluir ID de cotización
                customer_id: 1,
                items: quotationData.items,
                notes: quotationData.notes,
                document_type: 'FV-1'
            }, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Factura FV-1 creada exitosamente con quotation_id!');
            console.log('Respuesta:', JSON.stringify(quotationResponse2.data, null, 2));

        } catch (quotationError) {
            console.log('❌ Error con quotation_id:');
            console.log('Status:', quotationError.response?.status);
            console.log('Error:', JSON.stringify(quotationError.response?.data, null, 2));
        }

        console.log('\n=== Análisis completado ===');
        
    } catch (error) {
        console.error('❌ Error general:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
    }
}

fixFrontendInvoiceParameters();
