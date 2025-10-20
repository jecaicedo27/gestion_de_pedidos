const axios = require('axios');

async function debugInvoiceCreation() {
    console.log('🔍 Depurando creación de factura...\n');

    try {
        // 1. Login
        console.log('1. Iniciando sesión...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'admin@admin.com',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Sesión iniciada\n');

        // 2. Probar con los mismos datos que envía el frontend
        console.log('2. Enviando datos como el frontend...');
        
        const invoiceData = {
            customer_id: 1, // ID de prueba
            items: [
                {
                    product_code: 'IMPLE04',
                    product_name: 'Producto de prueba',
                    quantity: 1,
                    unit_price: 106,
                    price: 106 // Agregar price también
                }
            ],
            notes: 'Prueba de factura',
            document_type: 'FV-1',
            natural_language_order: '1 producto de prueba',
            chatgpt_processing_id: null
        };

        console.log('📤 Datos a enviar:', JSON.stringify(invoiceData, null, 2));

        try {
            const response = await axios.post(
                'http://localhost:3001/api/quotations/create-invoice',
                invoiceData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ Respuesta exitosa:', response.data);
        } catch (error) {
            console.log('\n❌ Error al crear factura:');
            console.log('Status:', error.response?.status);
            console.log('Mensaje:', error.response?.data?.message);
            console.log('Detalles completos:', JSON.stringify(error.response?.data, null, 2));
            
            // Información adicional para debug
            console.log('\n📊 Headers enviados:', error.config?.headers);
            console.log('📊 URL:', error.config?.url);
            console.log('📊 Method:', error.config?.method);
            console.log('📊 Data enviada:', error.config?.data);
        }

        // 3. Probar sin customer_id para ver el mensaje de error
        console.log('\n3. Probando sin customer_id para ver validación...');
        
        const invalidData = {
            items: [{
                product_code: 'TEST',
                quantity: 1,
                price: 100
            }],
            document_type: 'FV-1'
        };

        try {
            await axios.post(
                'http://localhost:3001/api/quotations/create-invoice',
                invalidData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
            console.log('❌ Error esperado (sin customer_id):');
            console.log('   Mensaje:', error.response?.data?.message);
        }

        // 4. Verificar qué estructura espera el backend
        console.log('\n4. Verificando estructura esperada por el backend...');
        console.log('   El backend debería aceptar:');
        console.log('   - Caso 1: { quotationId: string }');
        console.log('   - Caso 2: { customer_id: number, items: array, ... }');
        
    } catch (error) {
        console.error('Error general:', error.message);
    }
}

debugInvoiceCreation();
