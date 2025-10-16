const mysql = require('mysql2');
const axios = require('axios');

// Configuración de base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

// Función para hacer login y obtener token
async function loginAndGetToken() {
    try {
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        console.log('✅ Login exitoso');
        return response.data.token;
    } catch (error) {
        console.error('❌ Error en login:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Función para probar el endpoint de logística
async function testLogisticsEndpoint(token) {
    try {
        const response = await axios.get('http://localhost:3000/api/logistics/ready-for-delivery', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('\n=== RESPUESTA DEL ENDPOINT DE LOGÍSTICA ===');
        console.log('Status:', response.status);
        console.log('Total de grupos:', Object.keys(response.data).length);
        
        // Buscar específicamente el pedido de Ximena
        let ximenaPedidoEncontrado = false;
        
        Object.keys(response.data).forEach(carrier => {
            console.log(`\n--- ${carrier.toUpperCase()} ---`);
            console.log(`Pedidos: ${response.data[carrier].length}`);
            
            response.data[carrier].forEach(order => {
                console.log(`  - Pedido: ${order.order_number}`);
                console.log(`    Cliente: ${order.customer_name}`);
                console.log(`    Estado: ${order.status}`);
                console.log(`    Mensajero ID: ${order.assigned_messenger_id || 'Sin asignar'}`);
                console.log(`    Mensajero Status: ${order.messenger_status || 'N/A'}`);
                console.log(`    Mensajero Username: ${order.messenger_username || 'N/A'}`);
                console.log(`    Mensajero Nombre: ${order.messenger_full_name || 'N/A'}`);
                
                // Verificar si es el pedido de Ximena
                if (order.customer_name && order.customer_name.toUpperCase().includes('XIMENA')) {
                    ximenaPedidoEncontrado = true;
                    console.log('    🎯 ¡ESTE ES EL PEDIDO DE XIMENA!');
                }
                console.log('    ---');
            });
        });
        
        if (ximenaPedidoEncontrado) {
            console.log('\n✅ ¡PERFECTO! El pedido de Ximena ahora aparece en la respuesta del endpoint');
        } else {
            console.log('\n❌ El pedido de Ximena aún no aparece en la respuesta');
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Error en endpoint de logística:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Función para verificar estado actual del pedido en base de datos
async function verificarEstadoPedidoXimena() {
    const connection = mysql.createConnection(dbConfig);
    
    try {
        console.log('\n=== VERIFICANDO ESTADO ACTUAL EN BASE DE DATOS ===');
        
        const [rows] = await connection.promise().execute(`
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                o.status,
                o.assigned_messenger_id,
                o.messenger_status,
                u.username as messenger_username,
                u.full_name as messenger_full_name,
                o.delivery_method
            FROM orders o
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.customer_name LIKE '%XIMENA%'
        `);
        
        console.log(`Pedidos de Ximena encontrados: ${rows.length}`);
        rows.forEach(order => {
            console.log(`  - ID: ${order.id}, Pedido: ${order.order_number}`);
            console.log(`    Cliente: ${order.customer_name}`);
            console.log(`    Estado: ${order.status}`);
            console.log(`    Método de entrega: ${order.delivery_method}`);
            console.log(`    Mensajero ID: ${order.assigned_messenger_id || 'Sin asignar'}`);
            console.log(`    Mensajero Status: ${order.messenger_status || 'N/A'}`);
            console.log(`    Mensajero Username: ${order.messenger_username || 'N/A'}`);
            console.log(`    Mensajero Nombre: ${order.messenger_full_name || 'N/A'}`);
            console.log('    ---');
        });
        
    } catch (error) {
        console.error('Error verificando pedidos:', error);
    } finally {
        connection.end();
    }
}

// Función principal
async function main() {
    console.log('🧪 PRUEBA DE FIX LOGÍSTICA - PEDIDO DE XIMENA');
    console.log('================================================');
    
    try {
        // 1. Verificar estado actual en base de datos
        await verificarEstadoPedidoXimena();
        
        // 2. Hacer login
        const token = await loginAndGetToken();
        
        // 3. Probar endpoint de logística
        await testLogisticsEndpoint(token);
        
        console.log('\n🎉 PRUEBA COMPLETADA');
        console.log('Si el pedido de Ximena aparece ahora, el fix fue exitoso!');
        
    } catch (error) {
        console.error('\n💥 Error en la prueba:', error.message);
    }
}

// Ejecutar
main();
