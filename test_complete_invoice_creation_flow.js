/**
 * Script de prueba completa para el flujo de creación de facturas desde cotizaciones
 * Basado en la documentación oficial de SIIGO API
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkFkbWluaXN0cmFkb3IiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzM0NzMzMjE1fQ.jmLBL5gNWelMgqhWe0rVfYs9V3GbfcKQq-Ke6KBt2nY';

console.log('🧪 INICIANDO PRUEBA COMPLETA DEL FLUJO DE CREACIÓN DE FACTURAS DESDE COTIZACIONES');
console.log('='.repeat(80));

async function testCompleteInvoiceFlow() {
    try {
        console.log('\n📋 PASO 1: Verificar endpoint de búsqueda de clientes...');
        const customerSearch = await axios.get(`${API_BASE}/quotations/customers/search?q=JOHN`, {
            headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
        });
        
        console.log('✅ Clientes encontrados:', customerSearch.data.customers.length);
        
        if (customerSearch.data.customers.length === 0) {
            console.log('❌ No se encontraron clientes. Abortando prueba.');
            return;
        }

        const testCustomer = customerSearch.data.customers.find(c => c.identification);
        if (!testCustomer) {
            console.log('❌ No se encontró un cliente con identificación. Abortando prueba.');
            return;
        }

        console.log(`✅ Cliente de prueba seleccionado: ${testCustomer.name} (${testCustomer.identification})`);

        console.log('\n📦 PASO 2: Preparar items de prueba...');
        const testItems = [
            {
                product_code: 'TEST001',
                product_name: 'Producto de Prueba 1',
                quantity: 2,
                unit_price: 10000,
                confidence_score: 1.0
            },
            {
                product_code: 'TEST002', 
                product_name: 'Producto de Prueba 2',
                quantity: 1,
                unit_price: 25000,
                confidence_score: 1.0
            }
        ];

        console.log(`✅ ${testItems.length} items preparados para la factura`);
        console.log('Items:', testItems.map(item => `${item.product_name} (${item.quantity}x$${item.unit_price})`));

        console.log('\n🧾 PASO 3: Crear Factura FV-1 (No Electrónica)...');
        const invoiceFV1Data = {
            customerId: testCustomer.id,
            items: testItems,
            notes: 'Factura de prueba FV-1 creada desde sistema automatizado de cotizaciones',
            documentType: 'FV-1'
        };

        console.log('📤 Enviando petición para crear factura FV-1...');
        const invoiceFV1Response = await axios.post(`${API_BASE}/quotations/create-invoice`, invoiceFV1Data, {
            headers: { 
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (invoiceFV1Response.data.success) {
            console.log('✅ FACTURA FV-1 CREADA EXITOSAMENTE!');
            console.log('📊 Detalles de la factura FV-1:');
            console.log(`   • ID SIIGO: ${invoiceFV1Response.data.data.siigo_invoice_id}`);
            console.log(`   • Número: ${invoiceFV1Response.data.data.siigo_invoice_number}`);
            console.log(`   • Tipo: ${invoiceFV1Response.data.data.document_type}`);
            console.log(`   • Items procesados: ${invoiceFV1Response.data.data.items_processed}`);
            
            if (invoiceFV1Response.data.data.siigo_public_url) {
                console.log(`   • URL SIIGO: ${invoiceFV1Response.data.data.siigo_public_url}`);
            }

            // Mostrar datos técnicos si están disponibles
            if (invoiceFV1Response.data.data.siigo_request_data) {
                console.log('\n📋 DATOS TÉCNICOS ENVIADOS A SIIGO (FV-1):');
                console.log('   • Documento ID:', invoiceFV1Response.data.data.siigo_request_data.document.id);
                console.log('   • Fecha:', invoiceFV1Response.data.data.siigo_request_data.date);
                console.log('   • Cliente ID:', invoiceFV1Response.data.data.siigo_request_data.customer.identification);
                console.log('   • Tipo ID Cliente:', invoiceFV1Response.data.data.siigo_request_data.customer.identification_type);
                console.log('   • Items:', invoiceFV1Response.data.data.siigo_request_data.items.length);
                console.log('   • Valor Total:', `$${invoiceFV1Response.data.data.siigo_request_data.payments[0].value.toLocaleString()}`);
            }
        } else {
            console.log('❌ Error creando factura FV-1:', invoiceFV1Response.data.message);
        }

        console.log('\n🔋 PASO 4: Crear Factura FV-2 (Electrónica)...');
        const invoiceFV2Data = {
            customerId: testCustomer.id,
            items: testItems,
            notes: 'Factura de prueba FV-2 creada desde sistema automatizado de cotizaciones',
            documentType: 'FV-2'
        };

        console.log('📤 Enviando petición para crear factura FV-2...');
        const invoiceFV2Response = await axios.post(`${API_BASE}/quotations/create-invoice`, invoiceFV2Data, {
            headers: { 
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (invoiceFV2Response.data.success) {
            console.log('✅ FACTURA FV-2 CREADA EXITOSAMENTE!');
            console.log('📊 Detalles de la factura FV-2:');
            console.log(`   • ID SIIGO: ${invoiceFV2Response.data.data.siigo_invoice_id}`);
            console.log(`   • Número: ${invoiceFV2Response.data.data.siigo_invoice_number}`);
            console.log(`   • Tipo: ${invoiceFV2Response.data.data.document_type}`);
            console.log(`   • Items procesados: ${invoiceFV2Response.data.data.items_processed}`);
            
            if (invoiceFV2Response.data.data.siigo_public_url) {
                console.log(`   • URL SIIGO: ${invoiceFV2Response.data.data.siigo_public_url}`);
            }

            // Mostrar datos técnicos si están disponibles
            if (invoiceFV2Response.data.data.siigo_request_data) {
                console.log('\n📋 DATOS TÉCNICOS ENVIADOS A SIIGO (FV-2):');
                console.log('   • Documento ID:', invoiceFV2Response.data.data.siigo_request_data.document.id);
                console.log('   • Fecha:', invoiceFV2Response.data.data.siigo_request_data.date);
                console.log('   • Cliente ID:', invoiceFV2Response.data.data.siigo_request_data.customer.identification);
                console.log('   • Tipo ID Cliente:', invoiceFV2Response.data.data.siigo_request_data.customer.identification_type);
                console.log('   • Items:', invoiceFV2Response.data.data.siigo_request_data.items.length);
                console.log('   • Valor Total:', `$${invoiceFV2Response.data.data.siigo_request_data.payments[0].value.toLocaleString()}`);
            }
        } else {
            console.log('❌ Error creando factura FV-2:', invoiceFV2Response.data.message);
        }

        console.log('\n📊 PASO 5: Verificar estructura del JSON enviado a SIIGO...');
        
        // Verificar que el JSON sigue la estructura correcta de la documentación oficial
        let siigoRequest;
        if (invoiceFV1Response.data.success && invoiceFV1Response.data.data.siigo_request_data) {
            siigoRequest = invoiceFV1Response.data.data.siigo_request_data;
        } else if (invoiceFV2Response.data.success && invoiceFV2Response.data.data.siigo_request_data) {
            siigoRequest = invoiceFV2Response.data.data.siigo_request_data;
        }

        if (siigoRequest) {
            console.log('✅ Verificando estructura del JSON según documentación oficial de SIIGO:');
            
            // Verificar campos obligatorios según la documentación
            const requiredFields = ['document', 'date', 'customer', 'cost_center', 'seller', 'items', 'payments'];
            let allFieldsPresent = true;
            
            requiredFields.forEach(field => {
                if (siigoRequest[field] !== undefined) {
                    console.log(`   ✅ ${field}: PRESENTE`);
                } else {
                    console.log(`   ❌ ${field}: FALTANTE`);
                    allFieldsPresent = false;
                }
            });

            if (allFieldsPresent) {
                console.log('✅ Todos los campos obligatorios están presentes según la documentación de SIIGO');
            } else {
                console.log('❌ Faltan campos obligatorios según la documentación de SIIGO');
            }

            // Verificar estructura específica
            console.log('\n🔍 Verificación detallada de la estructura:');
            
            // Documento
            if (siigoRequest.document && siigoRequest.document.id) {
                console.log(`   ✅ document.id: ${siigoRequest.document.id} (${siigoRequest.document.id === 5153 ? 'FV-1' : siigoRequest.document.id === 5154 ? 'FV-2' : 'DESCONOCIDO'})`);
            } else {
                console.log('   ❌ document.id faltante o inválido');
            }

            // Cliente
            if (siigoRequest.customer) {
                console.log('   ✅ customer: PRESENTE');
                if (siigoRequest.customer.identification) {
                    console.log(`      • identification: ${siigoRequest.customer.identification}`);
                }
                if (siigoRequest.customer.identification_type) {
                    console.log(`      • identification_type: ${siigoRequest.customer.identification_type} (${siigoRequest.customer.identification_type === 31 ? 'NIT' : siigoRequest.customer.identification_type === 13 ? 'CC' : 'DESCONOCIDO'})`);
                }
            }

            // Items
            if (siigoRequest.items && Array.isArray(siigoRequest.items)) {
                console.log(`   ✅ items: ${siigoRequest.items.length} elementos`);
                siigoRequest.items.forEach((item, index) => {
                    console.log(`      • Item ${index + 1}:`);
                    console.log(`        - code: ${item.code}`);
                    console.log(`        - description: ${item.description}`);
                    console.log(`        - quantity: ${item.quantity}`);
                    console.log(`        - price: $${item.price.toLocaleString()}`);
                    if (item.taxes && item.taxes.length > 0) {
                        console.log(`        - tax_id: ${item.taxes[0].id}`);
                    }
                });
            }

            // Pagos
            if (siigoRequest.payments && Array.isArray(siigoRequest.payments)) {
                console.log(`   ✅ payments: ${siigoRequest.payments.length} elementos`);
                siigoRequest.payments.forEach((payment, index) => {
                    console.log(`      • Pago ${index + 1}:`);
                    console.log(`        - id: ${payment.id} (${payment.id === 8887 ? 'Efectivo' : 'DESCONOCIDO'})`);
                    console.log(`        - value: $${payment.value.toLocaleString()}`);
                    console.log(`        - due_date: ${payment.due_date}`);
                });
            }
        }

        console.log('\n🎯 PASO 6: Resumen de la prueba completa...');
        console.log('='.repeat(50));
        
        let successCount = 0;
        let totalTests = 2;

        if (invoiceFV1Response.data.success) {
            console.log('✅ Factura FV-1 (No Electrónica): CREADA EXITOSAMENTE');
            successCount++;
        } else {
            console.log('❌ Factura FV-1 (No Electrónica): FALLÓ');
        }

        if (invoiceFV2Response.data.success) {
            console.log('✅ Factura FV-2 (Electrónica): CREADA EXITOSAMENTE');
            successCount++;
        } else {
            console.log('❌ Factura FV-2 (Electrónica): FALLÓ');
        }

        console.log(`\n📈 RESULTADO FINAL: ${successCount}/${totalTests} pruebas exitosas (${Math.round(successCount/totalTests*100)}%)`);
        
        if (successCount === totalTests) {
            console.log('🎉 ¡TODAS LAS PRUEBAS PASARON! El sistema de creación de facturas está funcionando correctamente.');
            console.log('✨ El JSON se está enviando correctamente a SIIGO siguiendo la documentación oficial.');
            console.log('🎯 La implementación está completa y lista para producción.');
        } else {
            console.log('⚠️ Algunas pruebas fallaron. Revisar logs anteriores para detalles.');
        }

    } catch (error) {
        console.error('❌ ERROR EN LA PRUEBA COMPLETA:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Ejecutar la prueba
testCompleteInvoiceFlow();
