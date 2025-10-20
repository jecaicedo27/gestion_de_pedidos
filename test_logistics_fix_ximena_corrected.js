const mysql = require('mysql2');
const axios = require('axios');

// Configuración de base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

// Función para hacer login y obtener token válido
async function loginAndGetToken() {
    try {
        console.log('🔐 Intentando hacer login...');
        const response = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Login exitoso');
        console.log('Token response:', response.data);
        
        // Verificar que el token existe y tiene el formato correcto
        // El token puede estar en response.data.token o response.data.data.token
        const token = response.data.token || response.data.data?.token;
        if (!token) {
            throw new Error('No se recibió token en la respuesta');
        }
        
        console.log('Token recibido:', token.substring(0, 20) + '...');
        return token;
    } catch (error) {
        console.error('❌ Error en login:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
        throw error;
    }
}

// Función para probar el endpoint de logística con manejo de errores mejorado
async function testLogisticsEndpoint(token) {
    try {
        console.log('\n🚛 Probando endpoint de logística...');
        console.log('Token usado:', token.substring(0, 20) + '...');
        
        const response = await axios.get('http://localhost:3001/api/logistics/ready-for-delivery', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('\n=== RESPUESTA DEL ENDPOINT DE LOGÍSTICA ===');
        console.log('Status:', response.status);
        console.log('Estructura completa de response.data:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Verificar si response.data es un objeto con propiedades
        if (!response.data || typeof response.data !== 'object') {
            console.log('❌ Error: response.data no es un objeto válido');
            return response.data;
        }
        
        // Extraer los datos agrupados correctamente
        const groupedOrders = response.data.data?.groupedOrders || {};
        console.log('Total de grupos:', Object.keys(groupedOrders).length);
        
        // Buscar específicamente el pedido de Ximena
        let ximenaPedidoEncontrado = false;
        let ximenaPedidoDetails = null;
        
        Object.keys(groupedOrders).forEach(carrier => {
            console.log(`\n--- ${carrier.toUpperCase()} ---`);
            
            // Verificar que el carrier tenga un array de pedidos
            if (!Array.isArray(groupedOrders[carrier])) {
                console.log(`⚠️ ${carrier} no es un array. Tipo: ${typeof groupedOrders[carrier]}, Valor:`, groupedOrders[carrier]);
                return;
            }
            
            console.log(`Pedidos: ${groupedOrders[carrier].length}`);
            
            groupedOrders[carrier].forEach(order => {
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
                    ximenaPedidoDetails = order;
                    console.log('    🎯 ¡ESTE ES EL PEDIDO DE XIMENA!');
                }
                console.log('    ---');
            });
        });
        
        console.log('\n=== RESULTADO DE LA VERIFICACIÓN ===');
        if (ximenaPedidoEncontrado) {
            console.log('✅ ¡PERFECTO! El pedido de Ximena ahora aparece en la respuesta del endpoint');
            console.log('📋 Detalles del pedido de Ximena en el endpoint:');
            console.log('   - Pedido:', ximenaPedidoDetails.order_number);
            console.log('   - Cliente:', ximenaPedidoDetails.customer_name);
            console.log('   - Estado:', ximenaPedidoDetails.status);
            console.log('   - Mensajero ID:', ximenaPedidoDetails.assigned_messenger_id);
            console.log('   - Mensajero Status:', ximenaPedidoDetails.messenger_status);
            console.log('   - Mensajero Username:', ximenaPedidoDetails.messenger_username);
            console.log('   - Mensajero Nombre:', ximenaPedidoDetails.messenger_full_name);
        } else {
            console.log('❌ El pedido de Ximena aún no aparece en la respuesta');
        }
        
        return response.data;
    } catch (error) {
        console.error('\n❌ Error en endpoint de logística:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
            if (error.response.status === 401) {
                console.error('🔓 Error de autenticación - el token podría estar malformado o expirado');
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.error('🔌 No se pudo conectar al servidor backend - ¿está corriendo en puerto 3001?');
        } else {
            console.error('Message:', error.message);
        }
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
            ORDER BY o.id DESC
        `);
        
        console.log(`Pedidos de Ximena encontrados: ${rows.length}`);
        rows.forEach((order, index) => {
            console.log(`\n${index + 1}. ID: ${order.id}, Pedido: ${order.order_number}`);
            console.log(`   Cliente: ${order.customer_name}`);
            console.log(`   Estado: ${order.status}`);
            console.log(`   Método de entrega: ${order.delivery_method}`);
            console.log(`   Mensajero ID: ${order.assigned_messenger_id || 'Sin asignar'}`);
            console.log(`   Mensajero Status: ${order.messenger_status || 'N/A'}`);
            console.log(`   Mensajero Username: ${order.messenger_username || 'N/A'}`);
            console.log(`   Mensajero Nombre: ${order.messenger_full_name || 'N/A'}`);
        });
        
    } catch (error) {
        console.error('❌ Error verificando pedidos:', error.message);
    } finally {
        connection.end();
    }
}

// Función para verificar si el backend está corriendo
async function verificarBackendStatus() {
    try {
        console.log('\n🔍 Verificando si el backend está corriendo...');
        const response = await axios.get('http://localhost:3001/api/health', {
            timeout: 5000
        });
        console.log('✅ Backend está corriendo correctamente en puerto 3001');
        return true;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ El backend no está corriendo en puerto 3000');
            console.error('💡 Sugerencia: ejecuta "npm start" o "node backend/server.js" para iniciar el backend');
        } else {
            console.error('⚠️  Backend responde pero endpoint /api/health no existe:', error.message);
        }
        return false;
    }
}

// Función principal
async function main() {
    console.log('🧪 PRUEBA CORREGIDA DE FIX LOGÍSTICA - PEDIDO DE XIMENA');
    console.log('========================================================');
    
    try {
        // 1. Verificar si el backend está corriendo
        const backendRunning = await verificarBackendStatus();
        
        // 2. Verificar estado actual en base de datos
        await verificarEstadoPedidoXimena();
        
        if (!backendRunning) {
            console.log('\n⚠️  No se puede continuar con las pruebas de API sin el backend corriendo');
            console.log('💡 Para completar la verificación, inicia el backend y ejecuta este script nuevamente');
            return;
        }
        
        // 3. Hacer login
        const token = await loginAndGetToken();
        
        // 4. Probar endpoint de logística
        await testLogisticsEndpoint(token);
        
        console.log('\n🎉 PRUEBA COMPLETADA');
        console.log('Si el pedido de Ximena aparece ahora en el endpoint, el fix fue exitoso!');
        
    } catch (error) {
        console.error('\n💥 Error en la prueba:', error.message);
        
        // Proveer sugerencias según el tipo de error
        if (error.message.includes('jwt malformed')) {
            console.error('🔧 Sugerencia: Problema con el formato del JWT token');
            console.error('   - Verificar el middleware de autenticación');
            console.error('   - Revisar la configuración JWT_SECRET en .env');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.error('🔧 Sugerencia: El backend no está corriendo');
            console.error('   - Ejecutar: npm start');
            console.error('   - O ejecutar: node backend/server.js');
        }
    }
}

// Ejecutar
main();
