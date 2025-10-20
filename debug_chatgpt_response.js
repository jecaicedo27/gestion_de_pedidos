const axios = require('axios');
const mysql = require('mysql2/promise');

const API_URL = 'http://localhost:3001/api';

async function debugChatGPTResponse() {
    console.log('\n=== Debug de Respuesta de ChatGPT ===\n');
    
    let connection;
    
    try {
        // 1. Conectar a la base de datos
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        // 2. Buscar el cliente
        console.log('1. Buscando cliente con identificación 1082746400...');
        const [customers] = await connection.execute(
            'SELECT * FROM customers WHERE identification = ?',
            ['1082746400']
        );
        
        if (customers.length === 0) {
            console.log('✗ Cliente no encontrado');
            return;
        }
        
        const customer = customers[0];
        console.log(`✓ Cliente encontrado: ${customer.name || customer.commercial_name}`);
        console.log(`  ID: ${customer.id}`);
        
        // 3. Hacer login
        console.log('\n2. Haciendo login...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        console.log('✓ Login exitoso');

        // 4. Probar procesamiento con ChatGPT
        console.log('\n3. Procesando pedido con ChatGPT...');
        console.log('   Pedido: "2 paletas Liquipp 06 y 3 paletas Liquipp 07"');
        
        const chatGPTResponse = await axios.post(
            `${API_URL}/quotations/process-natural-order`,
            {
                customer_id: customer.id,
                natural_language_order: "2 paletas Liquipp 06 y 3 paletas Liquipp 07"
            },
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        console.log('\n=== RESPUESTA COMPLETA DE CHATGPT ===');
        console.log(JSON.stringify(chatGPTResponse.data, null, 2));
        
        if (chatGPTResponse.data.success) {
            console.log('\n✅ ChatGPT procesó exitosamente');
            
            // Verificar estructura de la respuesta
            console.log('\n=== ANÁLISIS DE LA RESPUESTA ===');
            console.log('- success:', chatGPTResponse.data.success);
            console.log('- Tiene data?:', chatGPTResponse.data.data ? 'SÍ' : 'NO');
            
            if (chatGPTResponse.data.data) {
                console.log('- Tiene products?:', chatGPTResponse.data.data.products ? 'SÍ' : 'NO');
                console.log('- Tiene totals?:', chatGPTResponse.data.data.totals ? 'SÍ' : 'NO');
                console.log('- Tiene quotation_id?:', chatGPTResponse.data.data.quotation_id ? 'SÍ' : 'NO');
                
                // Si hay productos, mostrarlos
                if (chatGPTResponse.data.data.products) {
                    console.log('\n=== PRODUCTOS IDENTIFICADOS ===');
                    console.log(JSON.stringify(chatGPTResponse.data.data.products, null, 2));
                }
                
                // Si hay totales, mostrarlos
                if (chatGPTResponse.data.data.totals) {
                    console.log('\n=== TOTALES CALCULADOS ===');
                    console.log(JSON.stringify(chatGPTResponse.data.data.totals, null, 2));
                }
            }
            
            // Intentar acceder a diferentes posibles estructuras
            console.log('\n=== VERIFICANDO POSIBLES ESTRUCTURAS ===');
            console.log('- chatGPTResponse.data.products?:', chatGPTResponse.data.products ? 'Existe' : 'No existe');
            console.log('- chatGPTResponse.data.items?:', chatGPTResponse.data.items ? 'Existe' : 'No existe');
            console.log('- chatGPTResponse.data.order_items?:', chatGPTResponse.data.order_items ? 'Existe' : 'No existe');
            
        } else {
            console.log('✗ ChatGPT no procesó correctamente');
            console.log('  Mensaje:', chatGPTResponse.data.message);
        }

    } catch (error) {
        console.log('\n✗ Error en la prueba:');
        
        if (error.response) {
            console.log(`  Status: ${error.response.status}`);
            console.log(`  Mensaje: ${error.response.data?.message || error.response.statusText}`);
            
            if (error.response.data?.details) {
                console.log('  Detalles:', JSON.stringify(error.response.data.details, null, 2));
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.log('  No se puede conectar al backend. ¿Está el servidor corriendo?');
        } else {
            console.log(`  ${error.message}`);
            console.log('  Stack:', error.stack);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar debug
debugChatGPTResponse();
