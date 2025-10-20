/**
 * Script simple para reproducir el error 500 real en facturas
 */

const axios = require('axios');
const mysql = require('mysql2/promise');

const API_BASE = 'http://localhost:3001/api';
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

console.log('🔧 REPRODUCIENDO ERROR 500 REAL - MÉTODO SIMPLE');
console.log('='.repeat(60));

async function reproduce500Error() {
    let connection;
    
    try {
        console.log('\n🔍 PASO 1: Conectar a la base de datos...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión exitosa a la base de datos');

        console.log('\n🎯 PASO 2: Obtener cliente para la prueba...');
        const [customers] = await connection.execute('SELECT * FROM customers LIMIT 1');
        
        if (customers.length === 0) {
            console.log('❌ No hay clientes en la base de datos');
            return;
        }
        
        const testCustomer = customers[0];
        console.log(`✅ Cliente: ${testCustomer.name} (ID: ${testCustomer.id})`);

        console.log('\n🔑 PASO 3: Intentar con token hardcodeado conocido...');
        
        // Usar el token que sabemos que el sistema ha generado antes
        const knownToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkFkbWluaXN0cmFkb3IiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzM0NzMzMjE1fQ.jmLBL5gNWelMgqhWe0rVfYs9V3GbfcKQq-Ke6KBt2nY';
        
        console.log('\n🧾 PASO 4: REPRODUCIR ERROR 500 CON TOKEN CONOCIDO...');
        
        const invoiceData = {
            customer_id: testCustomer.id,
            notes: 'Test invoice to reproduce 500 error - simplified',
            items: [
                {
                    product_code: 'TEST001',
                    product_name: 'Test Product',
                    quantity: 1,
                    unit_price: 10000,
                    confidence_score: 1.0
                }
            ],
            chatgpt_processing_id: `simple-test-${Date.now()}`,
            natural_language_order: 'Simple test order to reproduce 500 error'
        };

        console.log('📤 Enviando request que debería generar error 500...');
        console.log('URL:', `${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`);
        console.log('Customer ID:', testCustomer.id);
        console.log('Items:', invoiceData.items.length);

        try {
            const response = await axios.post(
                `${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`,
                invoiceData,
                {
                    headers: { 
                        'Authorization': `Bearer ${knownToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            console.log('❓ ¡INESPERADO! No se produjo error 500. Respuesta:');
            console.log(JSON.stringify(response.data, null, 2));

        } catch (error) {
            console.error('\n🎯 ERROR CAPTURADO:');
            console.error('='.repeat(30));
            console.error('Status:', error.response?.status);
            console.error('Status Text:', error.response?.statusText);
            
            if (error.response?.status === 500) {
                console.error('\n✅ ¡ERROR 500 REPRODUCIDO EXITOSAMENTE!');
                
                const errorData = error.response.data;
                console.error('📋 DETALLES COMPLETOS DEL ERROR:');
                console.error(JSON.stringify(errorData, null, 2));
                
                if (errorData?.message) {
                    console.log(`\n📝 MENSAJE DE ERROR: ${errorData.message}`);
                    
                    // Análisis específico
                    const message = errorData.message.toLowerCase();
                    
                    if (message.includes('cannot read property') || message.includes('cannot read properties')) {
                        console.log('🎯 TIPO: Error de JavaScript - Propiedad undefined');
                        console.log('💡 CAUSA PROBABLE: Variable no definida o null');
                        
                        // Buscar qué propiedad está undefined
                        const propertyMatch = errorData.message.match(/Cannot read propert(y|ies) of (undefined|null) \(reading '([^']+)'\)/);
                        if (propertyMatch) {
                            console.log(`🔍 PROPIEDAD FALTANTE: "${propertyMatch[3]}"`);
                        }
                    } else if (message.includes('siigo')) {
                        console.log('🎯 TIPO: Error de integración con SIIGO API');
                    } else if (message.includes('chatgpt') || message.includes('openai')) {
                        console.log('🎯 TIPO: Error de integración con ChatGPT/OpenAI');
                    } else if (message.includes('sql') || message.includes('database')) {
                        console.log('🎯 TIPO: Error de base de datos');
                    } else {
                        console.log('🎯 TIPO: Error no categorizado');
                    }
                }
                
                if (errorData?.stack) {
                    console.log('\n📋 STACK TRACE (líneas principales):');
                    const stackLines = errorData.stack.split('\n');
                    const relevantLines = stackLines.filter(line => 
                        line.includes('.js:') && 
                        !line.includes('node_modules')
                    ).slice(0, 5);
                    
                    relevantLines.forEach((line, index) => {
                        console.log(`${index + 1}: ${line.trim()}`);
                    });
                }
                
            } else if (error.response?.status === 401) {
                console.error('\n⚠️ Error 401 - Token inválido');
                console.error('El token hardcodeado no es válido. Necesitamos un token activo.');
                
                // Intentar sin token para ver si hay otro comportamiento
                console.log('\n🔄 PASO 5: Intentar sin token para ver el comportamiento...');
                
                try {
                    const responseNoAuth = await axios.post(
                        `${API_BASE}/quotations/create-siigo-invoice-with-chatgpt`,
                        invoiceData,
                        {
                            headers: { 
                                'Content-Type': 'application/json'
                            },
                            timeout: 10000
                        }
                    );
                    
                    console.log('❓ Respuesta sin token:', JSON.stringify(responseNoAuth.data, null, 2));
                    
                } catch (noAuthError) {
                    if (noAuthError.response?.status === 500) {
                        console.error('\n✅ ¡ERROR 500 SIN AUTENTICACIÓN!');
                        console.error('Esto indica que el error 500 ocurre ANTES de la validación de autenticación');
                        
                        const noAuthErrorData = noAuthError.response.data;
                        console.error('Error sin auth:', JSON.stringify(noAuthErrorData, null, 2));
                    } else {
                        console.error('Error sin auth (no 500):', noAuthError.response?.status, noAuthError.response?.data?.message);
                    }
                }
                
            } else {
                console.error('\n❌ Error diferente:', error.response?.status);
                console.error('Data:', JSON.stringify(error.response?.data, null, 2));
            }
        }

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
reproduce500Error();
