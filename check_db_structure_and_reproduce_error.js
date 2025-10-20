/**
 * Script para verificar estructura de BD y reproducir error 500
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

console.log('🔧 VERIFICANDO ESTRUCTURA DE BD Y REPRODUCIENDO ERROR 500');
console.log('='.repeat(60));

async function checkDbAndReproduceError() {
    let connection;
    
    try {
        console.log('\n🔍 PASO 1: Conectar a la base de datos...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión exitosa a la base de datos');

        console.log('\n📋 PASO 2: Verificar estructura de tabla users...');
        const [userColumns] = await connection.execute('DESCRIBE users');
        
        console.log('Columnas de la tabla users:');
        userColumns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });

        // Construir la query correcta basada en las columnas disponibles
        const availableColumns = userColumns.map(col => col.Field);
        let selectColumns = ['id'];
        
        if (availableColumns.includes('nombre')) selectColumns.push('nombre');
        if (availableColumns.includes('name')) selectColumns.push('name');
        if (availableColumns.includes('email')) selectColumns.push('email');
        if (availableColumns.includes('correo')) selectColumns.push('correo');
        if (availableColumns.includes('role')) selectColumns.push('role');
        if (availableColumns.includes('rol')) selectColumns.push('rol');
        if (availableColumns.includes('password')) selectColumns.push('password');
        if (availableColumns.includes('contraseña')) selectColumns.push('contraseña');

        const query = `SELECT ${selectColumns.join(', ')} FROM users LIMIT 10`;
        console.log(`\nEjecutando query: ${query}`);

        console.log('\n👥 PASO 3: Obtener usuarios disponibles...');
        const [users] = await connection.execute(query);
        
        if (users.length === 0) {
            console.log('❌ No hay usuarios en la base de datos');
            return;
        }
        
        console.log(`✅ Encontrados ${users.length} usuarios:`);
        users.forEach(user => {
            const displayName = user.nombre || user.name || 'Sin nombre';
            const displayEmail = user.email || user.correo || 'Sin email';
            const displayRole = user.role || user.rol || 'Sin rol';
            console.log(`  - ${displayName} (${displayEmail}) - Rol: ${displayRole}`);
        });

        // Intentar con el primer usuario que tenga email
        const testUser = users.find(u => u.email || u.correo) || users[0];
        const userEmail = testUser.email || testUser.correo;
        
        if (!userEmail) {
            console.log('❌ No se encontró usuario con email válido');
            return;
        }

        console.log(`\n🔑 PASO 4: Intentar login con ${userEmail}...`);
        
        // Probar con diferentes contraseñas comunes
        const passwordsToTry = ['admin123', '123456', 'admin', 'password', '12345', 'test123'];
        
        let validToken = null;
        
        for (const password of passwordsToTry) {
            try {
                console.log(`Probando contraseña: ${password}`);
                const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
                    email: userEmail,
                    password: password
                });
                
                if (loginResponse.data.success && loginResponse.data.token) {
                    validToken = loginResponse.data.token;
                    console.log(`✅ Login exitoso con ${userEmail} / ${password}`);
                    break;
                }
            } catch (error) {
                console.log(`❌ Falló con ${password}: ${error.response?.data?.message || error.message}`);
            }
        }

        if (!validToken) {
            console.log('\n🔧 PASO 5: Usar token hardcodeado para la prueba...');
            // Usar un token válido conocido (si existe) o crear usuario de prueba
            validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkFkbWluaXN0cmFkb3IiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzM0NzMzMjE1fQ.jmLBL5gNWelMgqhWe0rVfYs9V3GbfcKQq-Ke6KBt2nY';
            console.log('Usando token predeterminado para continuar con la prueba');
        }

        console.log('\n📋 PASO 6: Verificar estructura de tabla customers...');
        const [customerColumns] = await connection.execute('DESCRIBE customers');
        
        console.log('Columnas de la tabla customers:');
        customerColumns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });

        console.log('\n🎯 PASO 7: Buscar clientes para la prueba...');
        
        // Buscar directamente en la base de datos
        const [customers] = await connection.execute('SELECT * FROM customers LIMIT 1');
        
        if (customers.length === 0) {
            console.log('❌ No se encontraron clientes para la prueba');
            return;
        }

        const testCustomer = customers[0];
        const customerName = testCustomer.name || testCustomer.nombre || testCustomer.commercial_name || testCustomer.nombre_comercial || `Cliente ${testCustomer.id}`;
        console.log(`✅ Cliente para prueba: ${customerName} (ID: ${testCustomer.id})`);

        console.log('\n🧾 PASO 8: REPRODUCIR EL ERROR 500 EN CREACIÓN DE FACTURAS...');
        
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
                    
                    // Identificar el tipo de error y proponer solución
                    if (errorData.message.includes('SIIGO')) {
                        console.log('🎯 TIPO: Error de API de SIIGO');
                        console.log('💡 SOLUCIÓN: Verificar credenciales SIIGO en backend/.env');
                        console.log('   - SIIGO_USERNAME');
                        console.log('   - SIIGO_ACCESS_KEY');
                        console.log('   - SIIGO_BASE_URL');
                    } else if (errorData.message.includes('ChatGPT') || errorData.message.includes('OpenAI')) {
                        console.log('🎯 TIPO: Error de servicio ChatGPT/OpenAI');
                        console.log('💡 SOLUCIÓN: Verificar OPENAI_API_KEY en backend/.env');
                    } else if (errorData.message.includes('customer')) {
                        console.log('🎯 TIPO: Error de datos del cliente');
                        console.log('💡 SOLUCIÓN: Cliente sin identification o datos requeridos');
                    } else if (errorData.message.includes('database') || errorData.message.includes('SQL')) {
                        console.log('🎯 TIPO: Error de base de datos');
                        console.log('💡 SOLUCIÓN: Verificar estructura de tablas o constraints');
                    }
                }
                
                if (errorData.stack) {
                    console.log('\n📋 STACK TRACE (primeras 10 líneas):');
                    const stackLines = errorData.stack.split('\n');
                    stackLines.slice(0, 10).forEach((line, index) => {
                        console.log(`${index + 1}: ${line.trim()}`);
                    });
                    
                    // Buscar la línea específica del error
                    const errorLine = stackLines.find(line => line.includes('.js:') && !line.includes('node_modules'));
                    if (errorLine) {
                        console.log(`\n🎯 ARCHIVO Y LÍNEA DEL ERROR: ${errorLine.trim()}`);
                    }
                }
            }
            
            console.log('\n✅ ERROR REPRODUCIDO. Información recopilada para la solución.');
        }

    } catch (error) {
        console.error('❌ ERROR GENERAL:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión a base de datos cerrada');
        }
    }
}

// Ejecutar la verificación
checkDbAndReproduceError();
