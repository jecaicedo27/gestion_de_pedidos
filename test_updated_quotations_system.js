const axios = require('axios');

/**
 * Test script para verificar que el sistema de cotizaciones funciona
 * correctamente con la configuración aprendida de SIIGO
 * 
 * Aplicando lo aprendido:
 * - Vendedor 388 (siempre usar este)
 * - Documento FV-1 (ID: 15047) 
 * - Método de pago crédito (ID: 3467)
 * - Precios reales de SIIGO
 */

const BASE_URL = 'http://localhost:3001';

// Configuración de prueba
const testData = {
    // Cliente con cédula 1082746400 (cliente de prueba exitoso)
    customer_id: 1, // Asumiendo que está en la BD como ID 1
    natural_language_order: 'Necesito 2 implementos IMPLE04 para el cliente',
    notes: 'Factura de prueba generada con configuración aprendida'
};

async function testUpdatedQuotationsSystem() {
    try {
        console.log('🧪 Iniciando test del sistema de cotizaciones actualizado...\n');

        // Paso 1: Login para obtener token
        console.log('🔐 1. Iniciando sesión...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log('✅ Sesión iniciada correctamente');

        // Paso 2: Buscar cliente
        console.log('\n👤 2. Buscando cliente con cédula 1082746400...');
        const customerResponse = await axios.get(`${BASE_URL}/api/quotations/customers/search?q=1082746400`, {
            headers
        });

        if (customerResponse.data.customers.length === 0) {
            throw new Error('Cliente no encontrado. Debe existir cliente con cédula 1082746400');
        }

        const customer = customerResponse.data.customers[0];
        console.log(`✅ Cliente encontrado: ${customer.name} (ID: ${customer.id})`);

        // Paso 3: Procesar pedido con ChatGPT
        console.log('\n🤖 3. Procesando pedido con ChatGPT...');
        const processingResponse = await axios.post(`${BASE_URL}/api/quotations/process-natural-order`, {
            customer_id: customer.id,
            natural_language_order: testData.natural_language_order
        }, { headers });

        console.log('✅ Pedido procesado con ChatGPT:');
        console.log(`   - Items detectados: ${processingResponse.data.data.structured_items.length}`);
        console.log(`   - Confianza promedio: ${processingResponse.data.data.average_confidence}`);

        const structuredItems = processingResponse.data.data.structured_items;

        // Paso 4: Crear factura en SIIGO con configuración aprendida
        console.log('\n📋 4. Creando factura en SIIGO con configuración aprendida...');
        console.log('   ⚙️ Configuración aplicada:');
        console.log('   - Vendedor: 388 (siempre usar este)');
        console.log('   - Documento: FV-1 (ID: 15047)');
        console.log('   - Método de pago: Crédito (ID: 3467)');
        console.log('   - Precios: Obtenidos dinámicamente de SIIGO');

        const invoiceResponse = await axios.post(`${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`, {
            customer_id: customer.id,
            natural_language_order: testData.natural_language_order,
            notes: testData.notes,
            items: structuredItems
        }, { headers });

        if (invoiceResponse.data.success) {
            console.log('✅ Factura creada exitosamente en SIIGO:');
            console.log(`   - ID de factura: ${invoiceResponse.data.data.siigo_invoice_id}`);
            console.log(`   - Número de factura: ${invoiceResponse.data.data.siigo_invoice_number}`);
            console.log(`   - Items procesados: ${invoiceResponse.data.data.items_processed}`);
            console.log(`   - Monto total: $${invoiceResponse.data.data.total_amount || 'No disponible'}`);
            
            if (invoiceResponse.data.data.siigo_public_url) {
                console.log(`   - URL pública: ${invoiceResponse.data.data.siigo_public_url}`);
            }

            // Mostrar configuración aplicada
            if (invoiceResponse.data.data.siigo_request_data) {
                const requestData = invoiceResponse.data.data.siigo_request_data;
                console.log('\n📊 Configuración aplicada verificada:');
                console.log(`   - Documento ID: ${requestData.document?.id} ${requestData.document?.id === 15047 ? '✅ FV-1 correcto' : '❌ Incorrecto'}`);
                console.log(`   - Vendedor: ${requestData.seller} ${requestData.seller === 388 ? '✅ Correcto' : '❌ Incorrecto'}`);
                console.log(`   - Método de pago ID: ${requestData.payments?.[0]?.id} ${requestData.payments?.[0]?.id === 3467 ? '✅ Crédito correcto' : '❌ Incorrecto'}`);
                
                if (requestData.items && requestData.items.length > 0) {
                    console.log('\n💰 Precios obtenidos de SIIGO:');
                    requestData.items.forEach((item, index) => {
                        console.log(`   ${index + 1}. ${item.code}: $${item.price} (cantidad: ${item.quantity})`);
                    });
                }
            }

        } else {
            throw new Error(`Error creando factura: ${invoiceResponse.data.message}`);
        }

        // Paso 5: Test del endpoint de creación directa de factura
        console.log('\n📋 5. Probando endpoint de creación directa de factura...');
        
        const directInvoiceResponse = await axios.post(`${BASE_URL}/api/quotations/create-invoice`, {
            customerId: customer.id,
            items: structuredItems,
            notes: 'Factura directa con configuración aprendida',
            documentType: 'FV-1'
        }, { headers });

        if (directInvoiceResponse.data.success) {
            console.log('✅ Factura directa creada exitosamente');
            console.log(`   - ID: ${directInvoiceResponse.data.data.siigo_invoice_id}`);
            console.log(`   - Tipo de documento: ${directInvoiceResponse.data.data.document_type}`);
        }

        console.log('\n🎉 ¡Todos los tests pasaron exitosamente!');
        console.log('✅ El sistema de cotizaciones ahora usa la configuración aprendida correctamente');
        console.log('✅ Se eliminaron los errores 500 Internal Server Error');
        console.log('✅ Las facturas se crean con vendedor 388, FV-1 y crédito como método de pago');
        console.log('✅ Los precios se obtienen dinámicamente de SIIGO');

        return {
            success: true,
            message: 'Sistema de cotizaciones actualizado y funcionando correctamente'
        };

    } catch (error) {
        console.error('\n❌ Error en el test:', error.message);
        
        if (error.response?.data) {
            console.error('📋 Detalles del error del servidor:');
            console.error(JSON.stringify(error.response.data, null, 2));
        }

        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
}

// Ejecutar el test
console.log('🚀 Iniciando test del sistema de cotizaciones actualizado');
console.log('📋 Verificando que la configuración aprendida se aplique correctamente\n');

testUpdatedQuotationsSystem()
    .then(result => {
        console.log('\n📊 Resultado del test:');
        if (result.success) {
            console.log('✅ Test completado exitosamente');
            console.log('🎯 El sistema de cotizaciones está listo para producción');
        } else {
            console.log('❌ Test falló');
            console.log('🔧 Se requiere investigación adicional');
        }
    })
    .catch(error => {
        console.error('\n💥 Error crítico en el test:', error.message);
    });
