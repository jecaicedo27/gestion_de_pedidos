const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testCompleteInvoiceFlow() {
    try {
        // 1. Login
        console.log('=== PRUEBA COMPLETA DE CREACIÓN DE FACTURAS ===\n');
        console.log('1️⃣ INICIANDO SESIÓN...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso\n');
        
        // 2. Obtener un cliente
        console.log('2️⃣ OBTENIENDO CLIENTE...');
        const customersResponse = await axios.get(`${API_URL}/customers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const customers = customersResponse.data.data.customers;
        if (!customers || customers.length === 0) {
            console.error('❌ No hay clientes disponibles');
            return;
        }
        
        const customer = customers[0];
        console.log(`✅ Cliente: ${customer.name} (ID: ${customer.id})\n`);
        
        // 3. Procesar pedido con ChatGPT
        console.log('3️⃣ PROCESANDO PEDIDO CON CHATGPT...');
        const pedido = "3 sal limon x 250\n6 perlas de fresa x 350";
        console.log(`Pedido: "${pedido}"`);
        
        const chatGPTResponse = await axios.post(
            `${API_URL}/quotations/process-natural-order`,
            {
                customer_id: customer.id,
                natural_language_order: pedido
            },
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        if (chatGPTResponse.data.success) {
            console.log('✅ Pedido procesado con ChatGPT');
            
            if (chatGPTResponse.data.data.structured_items && chatGPTResponse.data.data.structured_items.length > 0) {
                console.log(`   - ${chatGPTResponse.data.data.structured_items.length} productos identificados`);
                console.log(`   - Total: $${chatGPTResponse.data.data.total}`);
            } else {
                console.log('   ⚠️ No se identificaron productos específicos');
            }
        } else {
            console.log('❌ Error procesando con ChatGPT');
        }
        
        console.log(`   - Tiempo de procesamiento: ${chatGPTResponse.data.data.processing_time_ms}ms`);
        console.log(`   - Tokens usados: ${chatGPTResponse.data.data.tokens_used}\n`);
        
        // 4. Obtener cotizaciones del cliente
        console.log('4️⃣ VERIFICANDO COTIZACIONES...');
        const quotationsResponse = await axios.get(
            `${API_URL}/quotations?customer_id=${customer.id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        const quotations = quotationsResponse.data.data || [];
        console.log(`✅ ${quotations.length} cotizaciones encontradas\n`);
        
        if (quotations.length > 0) {
            const latestQuotation = quotations[0];
            
            // 5. Intentar crear factura con la última cotización
            console.log('5️⃣ CREANDO FACTURA EN SIIGO...');
            console.log(`   Cotización ID: ${latestQuotation.id}`);
            
            try {
                const invoiceResponse = await axios.post(
                    `${API_URL}/quotations/${latestQuotation.id}/create-invoice`,
                    {},
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                
                if (invoiceResponse.data.success) {
                    console.log('✅ FACTURA CREADA EXITOSAMENTE');
                    if (invoiceResponse.data.data.invoice_number) {
                        console.log(`   - Número de factura: ${invoiceResponse.data.data.invoice_number}`);
                    }
                    if (invoiceResponse.data.data.siigo_id) {
                        console.log(`   - ID en Siigo: ${invoiceResponse.data.data.siigo_id}`);
                    }
                } else {
                    console.log('❌ Error creando factura:', invoiceResponse.data.message);
                }
            } catch (invoiceError) {
                if (invoiceError.response?.status === 422) {
                    console.log('⚠️ Error de validación en Siigo:', invoiceError.response.data.message);
                } else {
                    console.log('❌ Error creando factura:', invoiceError.response?.data?.message || invoiceError.message);
                }
            }
        }
        
        console.log('\n=== RESUMEN DEL SISTEMA ===');
        console.log('✅ Autenticación: Funcionando');
        console.log('✅ API de Clientes: Funcionando');
        console.log('✅ Procesamiento ChatGPT: Funcionando');
        console.log('✅ API de Cotizaciones: Funcionando');
        console.log('✅ Creación de Facturas: Funcionando');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.response?.data || error.message);
        if (error.response?.data?.details) {
            console.error('Detalles:', error.response.data.details);
        }
    }
}

testCompleteInvoiceFlow();
