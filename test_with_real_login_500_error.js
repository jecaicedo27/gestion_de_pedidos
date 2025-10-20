const axios = require('axios');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function testWithRealLogin() {
    console.log('🔧 PRUEBA CON LOGIN REAL PARA REPRODUCIR ERROR 500');
    console.log('============================================================\n');
    
    let connection;
    
    try {
        // 1. Conectar a la base de datos
        console.log('🔍 PASO 1: Conectar a la base de datos...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Conexión exitosa a la base de datos\n');

        // 2. Obtener un usuario admin válido
        console.log('👤 PASO 2: Obtener usuario admin válido...');
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE role = "admin" LIMIT 1'
        );
        
        if (users.length === 0) {
            throw new Error('No hay usuarios admin en la base de datos');
        }
        
        const testUser = users[0];
        console.log(`✅ Usuario encontrado: ${testUser.username} (${testUser.email})\n`);

        // 3. Hacer login para obtener token válido
        console.log('🔑 PASO 3: Hacer login real...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            email: testUser.email,
            password: 'admin123' // Contraseña por defecto del sistema
        });
        
        const { token, user } = loginResponse.data;
        console.log('✅ Login exitoso');
        console.log(`🎯 Token obtenido: ${token.substring(0, 20)}...`);
        console.log(`👤 Usuario logueado: ${user.username}\n`);

        // 4. Obtener cliente para la prueba
        console.log('🎯 PASO 4: Obtener cliente para la prueba...');
        const [customers] = await connection.execute(
            'SELECT * FROM customers WHERE name IS NOT NULL LIMIT 1'
        );
        
        if (customers.length === 0) {
            throw new Error('No hay clientes disponibles');
        }
        
        const testCustomer = customers[0];
        console.log(`✅ Cliente: ${testCustomer.name} (ID: ${testCustomer.id})\n`);

        // 5. Reproducir exactamente la llamada que falla
        console.log('🧾 PASO 5: REPRODUCIR ERROR 500 EXACTO...');
        console.log('📤 Enviando request exactamente como el frontend...');
        
        const invoiceData = {
            customerId: testCustomer.id,
            items: [
                {
                    code: 'TEST001',
                    name: 'Producto de Prueba',
                    quantity: 1,
                    price: 10000
                }
            ],
            notes: 'Prueba de reproducción de error 500',
            documentType: 'FV-1'
        };
        
        console.log('Request Data:', JSON.stringify(invoiceData, null, 2));
        console.log('URL:', 'http://localhost:3001/api/quotations/create-siigo-invoice-with-chatgpt');
        console.log('Headers:', { Authorization: `Bearer ${token.substring(0, 20)}...` });
        console.log('\n🎯 ENVIANDO REQUEST...\n');

        try {
            const response = await axios.post(
                'http://localhost:3001/api/quotations/create-siigo-invoice-with-chatgpt',
                invoiceData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('❌ NO HUBO ERROR 500 - Response exitoso:');
            console.log('Status:', response.status);
            console.log('Data:', JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            console.log('🎯 ERROR CAPTURADO:');
            console.log('==============================');
            console.log('Status:', error.response?.status);
            console.log('Status Text:', error.response?.statusText);
            console.log('Message:', error.message);
            
            if (error.response?.status === 500) {
                console.log('\n🔴 ERROR 500 REPRODUCIDO EXITOSAMENTE');
                console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
                
                // Analizar el stack trace del error
                if (error.response.data?.error) {
                    console.log('\n📋 ANÁLISIS DEL ERROR:');
                    console.log('Error:', error.response.data.error);
                    if (error.response.data.details) {
                        console.log('Detalles:', error.response.data.details);
                    }
                    if (error.response.data.stack) {
                        console.log('Stack Trace:');
                        console.log(error.response.data.stack);
                    }
                }
            } else {
                console.log(`⚠️ Error ${error.response?.status || 'desconocido'} - No es el 500 esperado`);
                console.log('Response Data:', JSON.stringify(error.response?.data, null, 2));
            }
        }

        // 6. También probar el endpoint nuevo que creamos
        console.log('\n🔄 PASO 6: Probar endpoint nuevo create-invoice...');
        try {
            const newEndpointResponse = await axios.post(
                'http://localhost:3001/api/quotations/create-invoice',
                invoiceData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Endpoint nuevo funciona correctamente:');
            console.log('Status:', newEndpointResponse.status);
            console.log('Data:', JSON.stringify(newEndpointResponse.data, null, 2));
            
        } catch (newError) {
            console.log('🎯 ERROR EN ENDPOINT NUEVO:');
            console.log('Status:', newError.response?.status);
            console.log('Message:', newError.message);
            console.log('Data:', JSON.stringify(newError.response?.data, null, 2));
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

// Ejecutar la prueba
testWithRealLogin();
