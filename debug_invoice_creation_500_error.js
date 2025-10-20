/**
 * Script de debugging para investigar el error 500 en creación de facturas
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

console.log('🔍 DEBUGGING ERROR 500 EN CREACIÓN DE FACTURAS');
console.log('='.repeat(60));

async function debugInvoiceCreation() {
    try {
        console.log('\n📋 PASO 1: Verificar si el backend está corriendo...');
        
        // Primero intentar hacer ping al servidor
        try {
            const healthCheck = await axios.get(`${API_BASE.replace('/api', '')}/health`);
            console.log('✅ Backend está corriendo');
        } catch (error) {
            console.log('⚠️ No se pudo hacer health check, pero continuando...');
        }

        console.log('\n🔑 PASO 2: Intentar obtener un token válido...');
        
        // Intentar login para obtener token válido
        const loginData = {
            email: 'admin@example.com',
            password: 'admin123'
        };

        let validToken;
        try {
            const loginResponse = await axios.post(`${API_BASE}/auth/login`, loginData);
            if (loginResponse.data.success && loginResponse.data.token) {
                validToken = loginResponse.data.token;
                console.log('✅ Token válido obtenido');
            } else {
                console.log('❌ Login falló, usando token predeterminado');
                validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkFkbWluaXN0cmFkb3IiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzM0NzMzMjE1fQ.jmLBL5gNWelMgqhWe0rVfYs9V3GbfcKQq-Ke6KBt2nY';
            }
        } catch (error) {
            console.log('❌ Error en login, usando token predeterminado');
            validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkFkbWluaXN0cmFkb3IiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzM0NzMzMjE1fQ.jmLBL5gNWelMgqhWe0rVfYs9V3GbfcKQq-Ke6KBt2nY';
        }

        console.log('\n👤 PASO 3: Buscar un cliente para la prueba...');
        
        let testCustomer;
        try {
            const customerResponse = await axios.get(`${API_BASE}/quotations/customers/search?q=JOHN`, {
                headers: { 'Authorization': `Bearer ${validToken}` }
            });
            
            if (customerResponse.data.success && customerResponse.data.customers.length > 0) {
                testCustomer = customerResponse.data.customers.find(c => c.identification) || customerResponse.data.customers[0];
                console.log(`✅ Cliente encontrado: ${testCustomer.name} (ID: ${testCustomer.id})`);
            } else {
                console.log('❌ No se encontraron clientes');
                return;
            }
        } catch (error) {
            console.error('❌ Error buscando clientes:', error.response?.data || error.message);
            return;
        }

        console.log('\n🧾 PASO 4: Intentar crear factura con ChatGPT (endpoint que está fallando)...');
        
        const invoiceData = {
            customer_id: testCustomer.id,
            notes: 'Factura de prueba para debugging error 500',
            items: [
                {
                    product_code: 'TEST001',
                    product_name: 'Producto de Prueba',
                    quantity: 1,
                    unit_price: 10000,
                    confidence_score: 1.0
                }
            ],
            chatgpt_processing_id: `debug-${Date.now()}`,
            natural_language_order: 'Pedido de prueba: 1 producto de prueba'
        };

        console.log('📤 Enviando petición a create-siigo-invoice-with-chatgpt...');
        console.log('Datos enviados:', JSON.stringify(invoiceData, null, 2));

        try {
            const response = await axios.post(`${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`, invoiceData, {
                headers: { 
                    'Authorization': `Bearer ${validToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ ¡ÉXITO! La factura fue creada correctamente');
            console.log('Respuesta:', JSON.stringify(response.data, null, 2));

        } catch (error) {
            console.error('❌ ERROR 500 REPRODUCIDO:');
            console.error('Status:', error.response?.status);
            console.error('Status Text:', error.response?.statusText);
            console.error('Headers:', error.response?.headers);
            console.error('Data:', JSON.stringify(error.response?.data, null, 2));
            
            // Analizar la causa del error
            if (error.response?.data) {
                console.log('\n🔍 ANÁLISIS DEL ERROR:');
                
                const errorData = error.response.data;
                
                if (errorData.message) {
                    console.log('• Mensaje de error:', errorData.message);
                }
                
                if (errorData.error) {
                    console.log('• Error específico:', errorData.error);
                }
                
                if (errorData.stack) {
                    console.log('• Stack trace:', errorData.stack);
                }

                // Verificar errores comunes
                if (errorData.message?.includes('SIIGO')) {
                    console.log('🎯 Posible problema con conexión a SIIGO');
                }
                
                if (errorData.message?.includes('customer')) {
                    console.log('🎯 Posible problema con datos del cliente');
                }
                
                if (errorData.message?.includes('token')) {
                    console.log('🎯 Posible problema con autenticación');
                }
                
                if (errorData.message?.includes('ChatGPT')) {
                    console.log('🎯 Posible problema con servicio de ChatGPT');
                }
            }
        }

        console.log('\n🧪 PASO 5: Intentar el nuevo endpoint create-invoice...');
        
        const newInvoiceData = {
            customerId: testCustomer.id,
            items: [
                {
                    product_code: 'TEST001',
                    product_name: 'Producto de Prueba',
                    quantity: 1,
                    unit_price: 10000
                }
            ],
            notes: 'Factura de prueba con nuevo endpoint',
            documentType: 'FV-1'
        };

        console.log('📤 Enviando petición a create-invoice (nuevo endpoint)...');

        try {
            const newResponse = await axios.post(`${API_BASE}/quotations/create-invoice`, newInvoiceData, {
                headers: { 
                    'Authorization': `Bearer ${validToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ ¡ÉXITO con nuevo endpoint!');
            console.log('Respuesta:', JSON.stringify(newResponse.data, null, 2));

        } catch (error) {
            console.error('❌ Error también en nuevo endpoint:');
            console.error('Status:', error.response?.status);
            console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        }

        console.log('\n🔧 PASO 6: Verificar configuración de SIIGO...');
        
        // Intentar hacer una llamada de prueba a SIIGO
        try {
            const siigoTestResponse = await axios.get(`${API_BASE}/quotations/customers/stats`, {
                headers: { 'Authorization': `Bearer ${validToken}` }
            });
            console.log('✅ Conexión a servicios relacionados funciona');
        } catch (error) {
            console.log('⚠️ Posible problema con servicios relacionados');
        }

    } catch (error) {
        console.error('❌ ERROR GENERAL EN EL DEBUGGING:', error.message);
    }
}

// Ejecutar debugging
debugInvoiceCreation();
