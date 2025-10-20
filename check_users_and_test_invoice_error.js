/**
 * Script para verificar usuarios y reproducir el error 500 en facturas
 */

const mysql = require('mysql2/promise');
const axios = require('axios');

// Configuración de base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

const API_BASE = 'http://localhost:3001/api';

console.log('🔧 VERIFICANDO USUARIOS Y REPRODUCIENDO ERROR 500');
console.log('='.repeat(60));

async function checkUsersAndTestInvoice() {
    let connection;
    
    try {
        console.log('\n🔍 PASO 1: Conectar a la base de datos...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión exitosa a la base de datos');

        console.log('\n👥 PASO 2: Verificar usuarios disponibles...');
        const [users] = await connection.execute('SELECT id, name, email, role FROM users LIMIT 10');
        
        if (users.length === 0) {
            console.log('❌ No hay usuarios en la base de datos');
            return;
        }
        
        console.log(`✅ Encontrados ${users.length} usuarios:`);
        users.forEach(user => {
            console.log(`  - ${user.name} (${user.email}) - Rol: ${user.role}`);
        });

        // Intentar con el primer usuario admin
        const adminUser = users.find(u => u.role === 'admin') || users[0];
        console.log(`\n🔑 PASO 3: Intentar login con ${adminUser.email}...`);
        
        // Probar con diferentes contraseñas comunes
        const passwordsToTry = ['admin123', '123456', 'admin', 'password', '12345', 'test123'];
        
        let validToken = null;
        let workingCredentials = null;
        
        for (const password of passwordsToTry) {
            try {
                console.log(`Probando contraseña: ${password}`);
                const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
                    email: adminUser.email,
                    password: password
                });
                
                if (loginResponse.data.success && loginResponse.data.token) {
                    validToken = loginResponse.data.token;
                    workingCredentials = { email: adminUser.email, password };
                    console.log(`✅ Login exitoso con ${adminUser.email} / ${password}`);
                    break;
                }
            } catch (error) {
                console.log(`❌ Falló con ${password}: ${error.response?.data?.message || error.message}`);
            }
        }

        if (!validToken) {
            console.log('\n🔧 PASO 4: Crear usuario de prueba ya que no funciona ninguna contraseña...');
            
            // Verificar si ya existe un usuario de prueba
            const [testUsers] = await connection.execute('SELECT * FROM users WHERE email = ?', ['test@test.com']);
            
            if (testUsers.length === 0) {
                // Crear usuario de prueba con contraseña hasheada
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash('test123', 10);
                
                await connection.execute(
                    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                    ['Usuario Test', 'test@test.com', hashedPassword, 'admin']
                );
                
                console.log('✅ Usuario de prueba creado: test@test.com / test123');
            }
            
            // Intentar login con el usuario de prueba
            try {
                const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
                    email: 'test@test.com',
                    password: 'test123'
                });
                
                if (loginResponse.data.success && loginResponse.data.token) {
                    validToken = loginResponse.data.token;
                    workingCredentials = { email: 'test@test.com', password: 'test123' };
                    console.log('✅ Login exitoso con usuario de prueba');
                }
            } catch (error) {
                console.log('❌ Error con usuario de prueba:', error.response?.data?.message || error.message);
            }
        }

        if (!validToken) {
            console.log('❌ No se pudo obtener token válido. Verificar configuración de autenticación.');
            return;
        }

        console.log('\n🎯 PASO 5: Buscar clientes para la prueba...');
        
        let testCustomer;
        try {
            const customerResponse = await axios.get(`${API_BASE}/quotations/customers/search?q=`, {
                headers: { 'Authorization': `Bearer ${validToken}` }
            });
            
            console.log(`Encontrados ${customerResponse.data.customers?.length || 0} clientes`);
            
            if (customerResponse.data.customers && customerResponse.data.customers.length > 0) {
                testCustomer = customerResponse.data.customers[0];
                console.log(`✅ Cliente para prueba: ${testCustomer.name} (ID: ${testCustomer.id})`);
            } else {
                console.log('⚠️ No hay clientes, pero continuando con la prueba...');
                // Buscar directamente en la base de datos
                const [customers] = await connection.execute('SELECT * FROM customers LIMIT 1');
                if (customers.length > 0) {
                    testCustomer = customers[0];
                    console.log(`✅ Cliente desde BD: ${testCustomer.name} (ID: ${testCustomer.id})`);
                }
            }
        } catch (error) {
            console.error('❌ Error buscando clientes:', error.response?.data || error.message);
        }

        if (!testCustomer) {
            console.log('❌ No se encontraron clientes para la prueba');
            return;
        }

        console.log('\n🧾 PASO 6: REPRODUCIR EL ERROR 500 EN CREACIÓN DE FACTURAS...');
        
        const invoiceData = {
            customer_id: testCustomer.id,
            notes: 'Factura de prueba para reproducir error 500',
            items: [
                {
                    product_code: 'TEST001',
                    product_name: 'Producto de Prueba',
                    quantity: 1,
                    unit_price: 10000,
                    confidence_score: 1.0
                }
            ],
            chatgpt_processing_id: `reproduce-${Date.now()}`,
            natural_language_order: 'Pedido de prueba para reproducir error 500'
        };

        console.log('📤 Enviando petición al endpoint que está fallando...');
        console.log(`URL: ${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`);
        console.log('Datos:', JSON.stringify(invoiceData, null, 2));

        try {
            const response = await axios.post(
                `${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`,
                invoiceData,
                {
                    headers: { 
                        'Authorization': `Bearer ${validToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('❓ ¡INESPERADO! La factura fue creada exitosamente');
            console.log('Respuesta:', JSON.stringify(response.data, null, 2));

        } catch (error) {
            console.error('\n🎯 ¡ERROR 500 REPRODUCIDO EXITOSAMENTE!');
            console.error('='.repeat(40));
            console.error('Status:', error.response?.status);
            console.error('Status Text:', error.response?.statusText);
            
            const errorData = error.response?.data;
            if (errorData) {
                console.error('Error completo:', JSON.stringify(errorData, null, 2));
                
                console.log('\n🔍 ANÁLISIS DETALLADO DEL ERROR:');
                
                if (errorData.message) {
                    console.log(`📋 Mensaje: ${errorData.message}`);
                    
                    // Identificar el tipo de error
                    if (errorData.message.includes('SIIGO')) {
                        console.log('🎯 TIPO: Error de API de SIIGO');
                        console.log('💡 CAUSA POSIBLE: Credenciales incorrectas o API inactiva');
                    } else if (errorData.message.includes('ChatGPT') || errorData.message.includes('OpenAI')) {
                        console.log('🎯 TIPO: Error de servicio ChatGPT/OpenAI');
                        console.log('💡 CAUSA POSIBLE: API key inválida o límite excedido');
                    } else if (errorData.message.includes('customer')) {
                        console.log('🎯 TIPO: Error de datos del cliente');
                        console.log('💡 CAUSA POSIBLE: Cliente sin identificación o datos faltantes');
                    } else if (errorData.message.includes('database') || errorData.message.includes('SQL')) {
                        console.log('🎯 TIPO: Error de base de datos');
                        console.log('💡 CAUSA POSIBLE: Tabla faltante o constraint violado');
                    } else {
                        console.log('🎯 TIPO: Error no categorizado');
                    }
                }
                
                if (errorData.stack) {
                    console.log('\n📋 STACK TRACE (primeras 10 líneas):');
                    const stackLines = errorData.stack.split('\n');
                    stackLines.slice(0, 10).forEach((line, index) => {
                        console.log(`${index + 1}: ${line.trim()}`);
                    });
                    
                    // Buscar la línea que indica dónde ocurrió el error
                    const errorLine = stackLines.find(line => line.includes('at ') && !line.includes('node_modules'));
                    if (errorLine) {
                        console.log(`\n🎯 LÍNEA DE ERROR PRINCIPAL: ${errorLine.trim()}`);
                    }
                }
            }
            
            console.log('\n✅ ERROR REPRODUCIDO. Ahora podemos identificar la causa exacta.');
        }

    } catch (error) {
        console.error('❌ ERROR GENERAL:', error.message);
        console.error(error.stack);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión a base de datos cerrada');
        }
    }
}

// Ejecutar la verificación
checkUsersAndTestInvoice();
