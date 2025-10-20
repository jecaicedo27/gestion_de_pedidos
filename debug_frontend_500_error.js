const axios = require('axios');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function debugFrontend500Error() {
    console.log('🔧 DEBUG FRONTEND 500 ERROR - EXACT REPRODUCTION');
    console.log('==================================================\n');
    
    let connection;
    
    try {
        // 1. Conectar a la base de datos
        console.log('🔍 PASO 1: Conectar a la base de datos...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Conexión exitosa a la base de datos\n');

        // 2. Obtener un usuario admin válido para login
        console.log('👤 PASO 2: Obtener usuario admin...');
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE role = "admin" LIMIT 1'
        );
        
        if (users.length === 0) {
            throw new Error('No hay usuarios admin en la base de datos');
        }
        
        const testUser = users[0];
        console.log(`✅ Usuario: ${testUser.username} (${testUser.email})\n`);

        // 3. Hacer login (esperar que pase el rate limiting)
        console.log('🔑 PASO 3: Intentando login (esperando rate limiting)...');
        let token = null;
        let loginAttempts = 0;
        
        while (!token && loginAttempts < 3) {
            try {
                // Probar ambos formatos de login
                let loginPayload = {
                    username: testUser.username,
                    password: 'admin123'
                };
                
                console.log(`🔍 Intentando login con username: ${testUser.username}`);
                
                const loginResponse = await axios.post('http://localhost:3001/api/auth/login', loginPayload);
                
                token = loginResponse.data.token;
                console.log('✅ Login exitoso');
                break;
            } catch (loginError) {
                loginAttempts++;
                if (loginError.response?.status === 429) {
                    console.log(`⏳ Rate limited, esperando ${loginError.response.data.retryAfter || 60}s...`);
                    await new Promise(resolve => setTimeout(resolve, (loginError.response.data.retryAfter || 60) * 1000));
                } else if (loginError.response?.status === 400 && loginAttempts === 1) {
                    // Probar con email si username falló
                    try {
                        console.log(`🔍 Probando con email: ${testUser.email}`);
                        const emailLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
                            email: testUser.email,
                            password: 'admin123'
                        });
                        token = emailLoginResponse.data.token;
                        console.log('✅ Login exitoso con email');
                        break;
                    } catch (emailError) {
                        console.log('❌ Login con email también falló:', emailError.response?.data?.message);
                        throw emailError;
                    }
                } else {
                    throw loginError;
                }
            }
        }

        if (!token) {
            console.log('❌ No se pudo obtener token válido');
            return;
        }

        // 4. Obtener un cliente válido
        console.log('🎯 PASO 4: Obtener cliente para prueba...');
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

        // 5. Reproducir exactamente la llamada del frontend
        console.log('🧾 PASO 5: REPRODUCIR LLAMADA EXACTA DEL FRONTEND...');
        
        // Datos exactos como los envía el frontend
        const frontendPayload = {
            customer_id: testCustomer.id,
            natural_language_order: 'Producto de prueba para testing',
            notes: 'Prueba de reproducción del error 500 del frontend',
            items: [
                {
                    product_name: 'Producto de Prueba',
                    quantity: 1,
                    unit_price: 10000,
                    code: 'TEST001'
                }
            ]
        };

        console.log('📤 Payload que envía el frontend:');
        console.log(JSON.stringify(frontendPayload, null, 2));
        console.log('\n🎯 ENVIANDO REQUEST AL ENDPOINT PROBLEMÁTICO...\n');

        try {
            const response = await axios.post(
                'http://localhost:3001/api/quotations/create-siigo-invoice-with-chatgpt',
                frontendPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000 // 60 segundos timeout
                }
            );
            
            console.log('❌ NO HUBO ERROR 500 - Response exitoso:');
            console.log('Status:', response.status);
            console.log('Data keys:', Object.keys(response.data));
            
        } catch (error) {
            console.log('🎯 ERROR 500 CAPTURADO:');
            console.log('==============================');
            console.log('Status:', error.response?.status);
            console.log('Status Text:', error.response?.statusText);
            console.log('URL:', error.config?.url);
            
            if (error.response?.status === 500) {
                console.log('\n🔴 ERROR 500 CONFIRMADO');
                console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
                
                // Analizar detalles del error
                if (error.response.data?.error) {
                    console.log('\n📋 ANÁLISIS DETALLADO DEL ERROR:');
                    console.log('Message:', error.response.data.message);
                    console.log('Error:', error.response.data.error);
                    
                    if (error.response.data.stack) {
                        console.log('\n📊 STACK TRACE:');
                        console.log(error.response.data.stack);
                    }
                }
                
                // Identificar la causa específica
                console.log('\n🔍 IDENTIFICANDO CAUSA ESPECÍFICA:');
                if (error.response.data?.error?.includes('ChatGPT') || error.response.data?.error?.includes('OpenAI')) {
                    console.log('❌ Error relacionado con ChatGPT API');
                } else if (error.response.data?.error?.includes('SIIGO') || error.response.data?.error?.includes('authentication')) {
                    console.log('❌ Error relacionado con SIIGO API');
                } else if (error.response.data?.error?.includes('customer') || error.response.data?.error?.includes('identification')) {
                    console.log('❌ Error relacionado con datos del cliente');
                } else if (error.response.data?.error?.includes('items') || error.response.data?.error?.includes('products')) {
                    console.log('❌ Error relacionado con productos/items');
                } else {
                    console.log('❌ Error no identificado - revisar stack trace');
                }
                
            } else {
                console.log(`⚠️ Error ${error.response?.status || 'desconocido'} - No es el 500 del frontend`);
                console.log('Response Data:', JSON.stringify(error.response?.data, null, 2));
            }
        }

        // 6. También probar el endpoint alternativo
        console.log('\n🔄 PASO 6: Probar endpoint create-invoice (alternativo)...');
        try {
            const altPayload = {
                customerId: testCustomer.id,
                items: [
                    {
                        product_name: 'Producto de Prueba Alt',
                        quantity: 1,
                        unit_price: 10000,
                        code: 'TEST002'
                    }
                ],
                notes: 'Prueba endpoint alternativo',
                documentType: 'FV-1'
            };

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
            
            console.log('✅ Endpoint alternativo funciona correctamente');
            console.log('Status:', altResponse.status);
            
        } catch (altError) {
            console.log('❌ Error en endpoint alternativo también:');
            console.log('Status:', altError.response?.status);
            console.log('Message:', altError.message);
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

// Ejecutar el debug
debugFrontend500Error().then(() => {
    console.log('\n🎉 DEBUG COMPLETADO');
}).catch(error => {
    console.error('❌ Error fatal:', error);
});
