const axios = require('axios');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function testFinal500ErrorFix() {
    console.log('🔧 TEST FINAL - REPRODUZIR Y SOLUCIONAR ERROR 500');
    console.log('==================================================\n');
    
    let connection;
    
    try {
        // 1. Conectar a la base de datos
        console.log('🔍 PASO 1: Conectar a la base de datos...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Conexión exitosa\n');

        // 2. Login con credenciales correctas
        console.log('🔑 PASO 2: Login con credenciales admin/admin123...');
        
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data?.token || loginResponse.data.token;
        console.log('✅ Login exitoso');
        
        if (token) {
            console.log(`🎯 Token obtenido: ${token.substring(0, 20)}...`);
        } else {
            console.log('⚠️ Token no encontrado en respuesta');
            console.log('Respuesta completa:', JSON.stringify(loginResponse.data, null, 2));
        }
        console.log('');

        // 3. Obtener un cliente válido
        console.log('🎯 PASO 3: Obtener cliente para prueba...');
        const [customers] = await connection.execute(
            'SELECT * FROM customers WHERE active = TRUE LIMIT 1'
        );
        
        if (customers.length === 0) {
            throw new Error('No hay clientes disponibles');
        }
        
        const testCustomer = customers[0];
        console.log(`✅ Cliente: ${testCustomer.name} (ID: ${testCustomer.id})`);
        console.log(`   • siigo_id: ${testCustomer.siigo_id || 'NULL'}`);
        console.log(`   • identification: ${testCustomer.identification || 'NULL'}\n`);

        // 4. Reproducir exactamente la llamada del frontend que falla
        console.log('🧾 PASO 4: REPRODUCIR ERROR 500 EXACTO DEL FRONTEND...');
        
        // Payload exacto como lo envía el frontend QuotationsPage.js
        const frontendPayload = {
            customer_id: testCustomer.id,
            natural_language_order: 'Producto de prueba para verificar error 500',
            notes: 'Prueba de reproducción del error 500 reportado',
            items: [
                {
                    product_name: 'Producto de Prueba',
                    quantity: 1,
                    unit_price: 15000,
                    code: 'TEST001'
                }
            ]
        };

        console.log('📤 Request payload:');
        console.log(JSON.stringify(frontendPayload, null, 2));
        console.log('\n🎯 ENVIANDO AL ENDPOINT PROBLEMÁTICO...');

        try {
            const response = await axios.post(
                'http://localhost:3001/api/quotations/create-siigo-invoice-with-chatgpt',
                frontendPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );
            
            console.log('✅ ÉXITO - No hubo error 500:');
            console.log('Status:', response.status);
            console.log('Success:', response.data.success);
            console.log('Message:', response.data.message);
            
            if (response.data.data?.siigo_invoice_id) {
                console.log('✅ Factura creada en SIIGO:', response.data.data.siigo_invoice_id);
            }
            
        } catch (error) {
            if (error.response?.status === 500) {
                console.log('🔴 ERROR 500 CONFIRMADO - ANALIZANDO...');
                console.log('======================================');
                console.log('Status:', error.response.status);
                console.log('URL:', error.config.url);
                
                const errorData = error.response.data;
                console.log('\n📋 DETALLES DEL ERROR:');
                console.log('Message:', errorData.message);
                
                if (errorData.error) {
                    console.log('\n🔍 ERROR ESPECÍFICO:');
                    console.log(typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error, null, 2));
                    
                    // Identificar tipo de error
                    const errorString = JSON.stringify(errorData.error).toLowerCase();
                    if (errorString.includes('chatgpt') || errorString.includes('openai')) {
                        console.log('\n❌ PROBLEMA: Error en ChatGPT API');
                    } else if (errorString.includes('siigo') || errorString.includes('authentication') || errorString.includes('token')) {
                        console.log('\n❌ PROBLEMA: Error en SIIGO API');
                    } else if (errorString.includes('customer') || errorString.includes('identification')) {
                        console.log('\n❌ PROBLEMA: Error en datos del cliente');
                    } else if (errorString.includes('items') || errorString.includes('products')) {
                        console.log('\n❌ PROBLEMA: Error en productos/items');
                    } else {
                        console.log('\n❌ PROBLEMA: Error no categorizado');
                    }
                }
                
                if (errorData.stack) {
                    console.log('\n📊 STACK TRACE:');
                    console.log(errorData.stack);
                }
                
            } else {
                console.log(`⚠️ Error ${error.response?.status || 'desconocido'}:`, error.message);
                console.log('Data:', JSON.stringify(error.response?.data, null, 2));
            }
        }

        // 5. Probar el endpoint alternativo que creamos
        console.log('\n🔄 PASO 5: Probar endpoint alternativo create-invoice...');
        
        const altPayload = {
            customerId: testCustomer.id,
            items: [
                {
                    product_name: 'Producto Alt Test',
                    quantity: 1,
                    unit_price: 12000,
                    code: 'ALT001'
                }
            ],
            notes: 'Test endpoint alternativo',
            documentType: 'FV-1'
        };

        try {
            const altResponse = await axios.post(
                'http://localhost:3001/api/quotations/create-invoice',
                altPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Endpoint alternativo funciona:');
            console.log('Status:', altResponse.status);
            console.log('Success:', altResponse.data.success);
            
            if (altResponse.data.data?.siigo_request_data) {
                console.log('\n📋 JSON GENERADO PARA SIIGO:');
                console.log('Customer:', altResponse.data.data.siigo_request_data.customer);
                console.log('Items:', altResponse.data.data.siigo_request_data.items.length);
                console.log('Document:', altResponse.data.data.siigo_request_data.document);
            }
            
        } catch (altError) {
            console.log('❌ Error en endpoint alternativo:');
            console.log('Status:', altError.response?.status);
            console.log('Message:', altError.message);
            console.log('Data:', JSON.stringify(altError.response?.data, null, 2));
        }

        // 6. Verificar estado del backend
        console.log('\n🔍 PASO 6: Verificar estado del backend...');
        
        try {
            const healthCheck = await axios.get('http://localhost:3001/api/auth/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('✅ Backend funcionando correctamente');
        } catch (healthError) {
            console.log('⚠️ Problema con backend:', healthError.response?.status);
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

// Ejecutar el test
testFinal500ErrorFix().then(() => {
    console.log('\n🎉 TEST FINAL COMPLETADO');
}).catch(error => {
    console.error('❌ Error fatal:', error);
});
