const mysql = require('mysql2/promise');

async function debugDeliveryRegistration403Error() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('🔍 Investigando error 403 en registro de entrega...\n');

        // 1. Verificar el pedido 537 (pedido de Ximena)
        console.log('📦 Información del pedido 537:');
        const [orderResult] = await connection.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                o.status,
                o.assigned_messenger_id,
                o.messenger_status,
                o.delivery_method,
                o.created_by,
                u.username as messenger_name,
                u.role as messenger_role
            FROM orders o
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.id = 537
        `);

        if (orderResult.length > 0) {
            console.table(orderResult);
        } else {
            console.log('❌ No se encontró el pedido 537');
            return;
        }

        // 2. Verificar permisos de usuario para actualizar pedidos
        console.log('\n🔐 Verificando estructura de permisos:');
        const [usersResult] = await connection.execute(`
            SELECT id, username, role, active
            FROM users 
            WHERE role IN ('admin', 'mensajero', 'employee')
            ORDER BY role, username
        `);
        console.table(usersResult);

        // 3. Verificar middleware de autenticación en el backend
        console.log('\n🔍 Verificando si hay restricciones por estado del pedido...');
        const order = orderResult[0];
        console.log(`Estado actual del pedido: ${order.status}`);
        console.log(`Mensajero asignado: ${order.messenger_name || 'Sin asignar'}`);
        console.log(`ID del mensajero: ${order.assigned_messenger_id || 'NULL'}`);

        // 4. Verificar logs recientes de errores 403
        console.log('\n📊 Análisis del problema:');
        console.log('- El error 403 sugiere un problema de permisos/autorización');
        console.log('- La validación de datos pasa correctamente');
        console.log('- El problema está en el middleware de autorización o controlador');

        console.log('\n🎯 Posibles causas:');
        console.log('1. Middleware de autenticación bloqueando la actualización');
        console.log('2. Restricciones de rol para actualizar pedidos "en_reparto"');
        console.log('3. Validación de que solo el mensajero asignado puede actualizar');
        console.log('4. Token JWT inválido o expirado');

    } catch (error) {
        console.error('❌ Error en el debug:', error);
    } finally {
        await connection.end();
    }
}

debugDeliveryRegistration403Error().catch(console.error);
