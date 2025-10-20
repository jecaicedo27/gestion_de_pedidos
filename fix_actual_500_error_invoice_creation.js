/**
 * Script para identificar y solucionar el verdadero error 500 en creación de facturas
 */

const axios = require('axios');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://localhost:3001/api';
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

console.log('🔧 SOLUCIONANDO EL ERROR 500 REAL EN CREACIÓN DE FACTURAS');
console.log('='.repeat(60));

async function fixActual500Error() {
    let connection;
    
    try {
        console.log('\n🔍 PASO 1: Crear usuario y obtener token válido...');
        connection = await mysql.createConnection(dbConfig);
        
        // Crear un usuario temporal con contraseña conocida
        const tempEmail = 'temp-test@test.com';
        const tempPassword = 'temp123';
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        // Eliminar usuario temporal si ya existe
        await connection.execute('DELETE FROM users WHERE email = ?', [tempEmail]);
        
        // Crear usuario temporal
        await connection.execute(
            'INSERT INTO users (username, email, password, role, full_name, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            ['temp-test', tempEmail, hashedPassword, 'admin', 'Usuario Temporal', 1]
        );
        
        console.log('✅ Usuario temporal creado');

        // Obtener token válido
        console.log('\n🔑 PASO 2: Obtener token de autenticación...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: tempEmail,
            password: tempPassword
        });
        
        if (!loginResponse.data.success) {
            console.log('❌ Error en login:', loginResponse.data.message);
            return;
        }
        
        const validToken = loginResponse.data.token;
        console.log('✅ Token válido obtenido');

        console.log('\n🎯 PASO 3: Obtener cliente para la prueba...');
        const [customers] = await connection.execute('SELECT * FROM customers LIMIT 1');
        
        if (customers.length === 0) {
            console.log('❌ No hay clientes en la base de datos');
            return;
        }
        
        const testCustomer = customers[0];
        console.log(`✅ Cliente: ${testCustomer.name} (ID: ${testCustomer.id})`);

        console.log('\n🧾 PASO 4: REPRODUCIR ERROR 500 CON TOKEN VÁLIDO...');
        
        const invoiceData = {
            customer_id: testCustomer.id,
            notes: 'Test invoice to reproduce 500 error',
            items: [
                {
                    product_code: 'TEST001',
                    product_name: 'Test Product',
                    quantity: 1,
                    unit_price: 10000,
                    confidence_score: 1.0
                }
            ],
            chatgpt_processing_id: `test-${Date.now()}`,
            natural_language_order: 'Test order to reproduce 500 error'
        };

        console.log('📤 Enviando request que debería generar error 500...');
        console.log('URL:', `${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`);
        console.log('Data:', JSON.stringify(invoiceData, null, 2));

        try {
            const response = await axios.post(
                `${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`,
                invoiceData,
                {
                    headers: { 
                        'Authorization': `Bearer ${validToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 segundos de timeout
                }
            );

            console.log('❓ ¡INESPERADO! No se produjo error 500. Respuesta:');
            console.log(JSON.stringify(response.data, null, 2));

        } catch (error) {
            if (error.response?.status === 500) {
                console.error('\n🎯 ¡ERROR 500 REPRODUCIDO EXITOSAMENTE!');
                console.error('='.repeat(50));
                
                const errorData = error.response.data;
                console.error('📋 DETALLES COMPLETOS DEL ERROR:');
                console.error(JSON.stringify(errorData, null, 2));
                
                if (errorData.message) {
                    console.log(`\n📝 MENSAJE: ${errorData.message}`);
                }
                
                if (errorData.stack) {
                    console.log('\n📋 STACK TRACE COMPLETO:');
                    const stackLines = errorData.stack.split('\n');
                    stackLines.forEach((line, index) => {
                        console.log(`${String(index + 1).padStart(2)}: ${line.trim()}`);
                    });
                    
                    // Encontrar líneas clave del error
                    console.log('\n🎯 LÍNEAS CLAVE DEL ERROR:');
                    const keyLines = stackLines.filter(line => 
                        line.includes('.js:') && 
                        !line.includes('node_modules') &&
                        (line.includes('backend') || line.includes('services') || line.includes('controllers'))
                    );
                    keyLines.forEach((line, index) => {
                        console.log(`${index + 1}. ${line.trim()}`);
                    });
                }
                
                // Análisis específico del error
                console.log('\n🔍 ANÁLISIS DEL ERROR:');
                
                if (errorData.message) {
                    const message = errorData.message.toLowerCase();
                    
                    if (message.includes('siigo')) {
                        console.log('🎯 TIPO: Error de integración con SIIGO API');
                        console.log('💡 POSIBLES CAUSAS:');
                        console.log('   - Credenciales de SIIGO incorrectas o expiradas');
                        console.log('   - API de SIIGO no disponible');
                        console.log('   - Estructura de datos incorrecta para SIIGO');
                    } else if (message.includes('openai') || message.includes('chatgpt')) {
                        console.log('🎯 TIPO: Error de integración con OpenAI/ChatGPT');
                        console.log('💡 POSIBLES CAUSAS:');
                        console.log('   - API Key de OpenAI inválida o expirada');
                        console.log('   - Límite de cuota de OpenAI excedido');
                        console.log('   - Estructura de request a OpenAI incorrecta');
                    } else if (message.includes('sql') || message.includes('database')) {
                        console.log('🎯 TIPO: Error de base de datos');
                        console.log('💡 POSIBLES CAUSAS:');
                        console.log('   - Tabla o columna faltante');
                        console.log('   - Constraint de base de datos violado');
                        console.log('   - Error de sintaxis SQL');
                    } else if (message.includes('cannot read property') || message.includes('undefined')) {
                        console.log('🎯 TIPO: Error de JavaScript - Propiedad undefined');
                        console.log('💡 POSIBLES CAUSAS:');
                        console.log('   - Objeto no definido o null');
                        console.log('   - Falta validación de datos de entrada');
                    } else {
                        console.log('🎯 TIPO: Error no categorizado');
                        console.log(`📝 Mensaje: ${errorData.message}`);
                    }
                }
                
                console.log('\n🔧 PASOS PARA SOLUCIONAR:');
                console.log('1. Revisar el archivo y línea específica del error');
                console.log('2. Verificar las variables y objetos en esa línea');
                console.log('3. Agregar validaciones necesarias');
                console.log('4. Probar la corrección');
                
            } else {
                console.error('\n❌ Error diferente a 500:');
                console.error('Status:', error.response?.status);
                console.error('Message:', error.response?.data?.message || error.message);
            }
        }

        // Limpiar usuario temporal
        console.log('\n🧹 PASO 5: Limpieza...');
        await connection.execute('DELETE FROM users WHERE email = ?', [tempEmail]);
        console.log('✅ Usuario temporal eliminado');

    } catch (error) {
        console.error('❌ ERROR GENERAL:', error.message);
        console.error(error.stack);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

// Ejecutar
fixActual500Error();
