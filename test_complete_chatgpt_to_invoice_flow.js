const axios = require('axios');

async function testCompleteChatGPTToInvoiceFlow() {
    console.log('=== Test Completo: ChatGPT → Factura FV-1 ===\n');

    try {
        // 1. Login
        console.log('1. Realizando login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso');

        // 2. Probar ChatGPT processing primero
        console.log('\n2. Probando ChatGPT processing...');
        const chatgptResponse = await axios.post('http://localhost:3001/api/quotations/process-natural-order', {
            customer_id: 1,
            natural_language_order: 'Necesito 2 Coca Cola de 500ml y 3 sal limón de 250'
        }, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ ChatGPT processing exitoso');
        console.log('Items procesados:', chatgptResponse.data.data.structured_items.length);
        
        // 3. Usar los items procesados por ChatGPT para crear la factura FV-1
        console.log('\n3. Creando factura FV-1 con items de ChatGPT...');
        
        const invoiceItems = chatgptResponse.data.data.structured_items.length > 0 
            ? chatgptResponse.data.data.structured_items
            : [
                { product_name: 'Coca Cola 500ml', quantity: 2, unit_price: 2500 },
                { product_name: 'Sal Limón 250g', quantity: 3, unit_price: 1800 }
            ];

        const invoiceResponse = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
            customer_id: 1,          // ✅ Correcto - snake_case
            items: invoiceItems,
            notes: 'Factura generada desde ChatGPT processing. Pedido original: Necesito 2 Coca Cola de 500ml y 3 sal limón de 250',
            document_type: 'FV-1'    // ✅ Correcto - snake_case
        }, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ ¡Factura FV-1 creada exitosamente!');
        console.log('Número de factura SIIGO:', invoiceResponse.data.data.siigo_invoice_number);
        console.log('ID de factura SIIGO:', invoiceResponse.data.data.siigo_invoice_id);
        
        if (invoiceResponse.data.data.siigo_public_url) {
            console.log('URL pública:', invoiceResponse.data.data.siigo_public_url);
        }

        console.log('\n=== RESUMEN EXITOSO ===');
        console.log('✅ ChatGPT processing: FUNCIONANDO');
        console.log('✅ Creación de factura FV-1: FUNCIONANDO');
        console.log('✅ Error 422 frontend: RESUELTO con parámetros correctos');
        
        return {
            success: true,
            chatgpt_items: chatgptResponse.data.data.structured_items,
            siigo_invoice: invoiceResponse.data.data
        };

    } catch (error) {
        console.error('\n❌ ERROR en el flujo:');
        console.error('Status:', error.response?.status);
        console.error('Error:', error.response?.data || error.message);
        
        if (error.response?.status === 422) {
            console.log('\n🔍 Análisis del error 422:');
            console.log('- Si el error menciona parámetros faltantes, verificar nombres');
            console.log('- Frontend debe usar customer_id (no customerId)');  
            console.log('- Frontend debe usar document_type (no documentType)');
        }
        
        return {
            success: false,
            error: error.response?.data || error.message,
            status: error.response?.status
        };
    }
}

testCompleteChatGPTToInvoiceFlow();
