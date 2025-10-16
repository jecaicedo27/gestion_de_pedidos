/**
 * Script para solucionar el error 500 en creación de facturas paso a paso
 */

const axios = require('axios');
const API_BASE = 'http://localhost:3001/api';

console.log('🔧 SOLUCIONANDO ERROR 500 EN CREACIÓN DE FACTURAS');
console.log('='.repeat(60));

async function fixInvoiceError() {
    try {
        console.log('\n🔍 PASO 1: Verificar conexión al backend...');
        
        try {
            const healthResponse = await axios.get(`${API_BASE.replace('/api', '')}`);
            console.log('✅ Backend está funcionando');
        } catch (error) {
            console.log('⚠️ Verificando backend de otra manera...');
        }

        console.log('\n👤 PASO 2: Intentar obtener usuarios disponibles...');
        
        // Primero intentar obtener usuarios sin autenticación para ver si el endpoint funciona
        try {
            const usersCheck = await axios.get(`${API_BASE}/auth/check`);
            console.log('Sistema de auth disponible');
        } catch (error) {
            console.log('Verificando sistema...');
        }

        console.log('\n🔑 PASO 3: Intentar login con diferentes credenciales...');
        
        const credentials = [
            { email: 'admin@admin.com', password: 'admin123' },
            { email: 'admin@example.com', password: 'admin123' },
            { email: 'admin', password: 'admin123' },
            { email: 'test@test.com', password: 'test123' }
        ];

        let validToken = null;
        let validUser = null;

        for (const cred of credentials) {
            try {
                console.log(`Probando login con: ${cred.email}`);
                const loginResponse = await axios.post(`${API_BASE}/auth/login`, cred);
                
                if (loginResponse.data.success && loginResponse.data.token) {
                    validToken = loginResponse.data.token;
                    validUser = loginResponse.data.user;
                    console.log(`✅ Login exitoso con: ${cred.email}`);
                    break;
                }
            } catch (error) {
                console.log(`❌ Login falló con ${cred.email}: ${error.response?.data?.message || error.message}`);
            }
        }

        if (!validToken) {
            console.log('❌ No se pudo obtener token válido. Revisemos la base de datos...');
            return;
        }

        console.log('\n🎯 PASO 4: Probar búsqueda de clientes...');
        
        try {
            const customerResponse = await axios.get(`${API_BASE}/quotations/customers/search?q=`, {
                headers: { 'Authorization': `Bearer ${validToken}` }
            });
            
            console.log(`✅ Búsqueda de clientes funciona. Encontrados: ${customerResponse.data.customers?.length || 0}`);
            
            if (customerResponse.data.customers && customerResponse.data.customers.length > 0) {
                const testCustomer = customerResponse.data.customers[0];
                console.log(`Cliente de prueba: ${testCustomer.name} (ID: ${testCustomer.id})`);
                
                console.log('\n🧾 PASO 5: Probar creación de factura...');
                
                const invoiceData = {
                    customer_id: testCustomer.id,
                    notes: 'Factura de prueba para solucionar error 500',
                    items: [
                        {
                            product_code: 'TEST001',
                            product_name: 'Producto de Prueba',
                            quantity: 1,
                            unit_price: 10000,
                            confidence_score: 1.0
                        }
                    ],
                    chatgpt_processing_id: `fix-${Date.now()}`,
                    natural_language_order: 'Pedido de prueba para solucionar error 500'
                };

                console.log('📤 Intentando crear factura...');

                try {
                    const invoiceResponse = await axios.post(
                        `${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`, 
                        invoiceData, 
                        {
                            headers: { 
                                'Authorization': `Bearer ${validToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    console.log('✅ ¡FACTURA CREADA EXITOSAMENTE!');
                    console.log('Respuesta:', JSON.stringify(invoiceResponse.data, null, 2));
                    
                } catch (invoiceError) {
                    console.error('❌ ERROR EN CREACIÓN DE FACTURA:');
                    console.error('Status:', invoiceError.response?.status);
                    console.error('Data:', JSON.stringify(invoiceError.response?.data, null, 2));
                    
                    // Analizar el error específico
                    const errorData = invoiceError.response?.data;
                    
                    if (errorData?.message) {
                        console.log('\n🔍 ANÁLISIS DEL ERROR:');
                        console.log('Mensaje:', errorData.message);
                        
                        if (errorData.message.includes('SIIGO')) {
                            console.log('🎯 Problema con API de SIIGO');
                            console.log('💡 Solución: Verificar credenciales de SIIGO en .env');
                        }
                        
                        if (errorData.message.includes('customer')) {
                            console.log('🎯 Problema con datos del cliente');
                            console.log('💡 Solución: Verificar estructura de datos del cliente');
                        }
                        
                        if (errorData.message.includes('ChatGPT') || errorData.message.includes('OpenAI')) {
                            console.log('🎯 Problema con servicio de ChatGPT');
                            console.log('💡 Solución: Verificar API key de OpenAI en .env');
                        }
                        
                        if (errorData.message.includes('database') || errorData.message.includes('SQL')) {
                            console.log('🎯 Problema con base de datos');
                            console.log('💡 Solución: Verificar estructura de tablas');
                        }
                    }
                    
                    if (errorData?.stack) {
                        console.log('\n📋 STACK TRACE:');
                        console.log(errorData.stack.split('\n').slice(0, 5).join('\n'));
                    }
                }
                
            } else {
                console.log('❌ No hay clientes disponibles para la prueba');
            }
            
        } catch (customerError) {
            console.error('❌ Error en búsqueda de clientes:', customerError.response?.data || customerError.message);
        }

    } catch (error) {
        console.error('❌ ERROR GENERAL:', error.message);
    }
}

// Ejecutar la solución
fixInvoiceError();
