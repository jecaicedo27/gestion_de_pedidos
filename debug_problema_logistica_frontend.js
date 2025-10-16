const mysql = require('mysql2/promise');

async function diagnosticarProblemaLogistica() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        console.log('=== DIAGNÓSTICO COMPLETO DEL PROBLEMA DE LOGÍSTICA ===\n');
        
        console.log('1. PEDIDO ESPECÍFICO DE XIMENA (ID: 537):');
        const [ximenadOrder] = await connection.execute(
            'SELECT id, order_number, customer_name, status, messenger_status, assigned_messenger_id, delivery_method FROM orders WHERE id = 537'
        );
        
        if (ximenadOrder.length > 0) {
            const order = ximenadOrder[0];
            console.log(`   - ID: ${order.id}`);
            console.log(`   - Número: ${order.order_number}`);
            console.log(`   - Cliente: ${order.customer_name}`);
            console.log(`   - Status: ${order.status}`);
            console.log(`   - Messenger Status: ${order.messenger_status}`);
            console.log(`   - Assigned Messenger ID: ${order.assigned_messenger_id}`);
            console.log(`   - Delivery Method: ${order.delivery_method}`);
        }

        console.log('\n2. INFORMACIÓN DEL MENSAJERO ASIGNADO (ID: 15):');
        const [messengerInfo] = await connection.execute(
            'SELECT id, username, full_name, role FROM users WHERE id = 15'
        );
        
        if (messengerInfo.length > 0) {
            const messenger = messengerInfo[0];
            console.log(`   - ID: ${messenger.id}`);
            console.log(`   - Username: ${messenger.username}`);
            console.log(`   - Full Name: ${messenger.full_name}`);
            console.log(`   - Role: ${messenger.role}`);
        } else {
            console.log('   ⚠️  PROBLEMA: No se encontró mensajero con ID 15!');
        }

        console.log('\n3. TODOS LOS PEDIDOS EN REPARTO:');
        const [repartoOrders] = await connection.execute(
            'SELECT id, order_number, customer_name, status, messenger_status, assigned_messenger_id, delivery_method FROM orders WHERE status = "en_reparto" ORDER BY id'
        );
        
        console.log(`   Total de pedidos en reparto: ${repartoOrders.length}`);
        repartoOrders.forEach(order => {
            console.log(`   - ID: ${order.id}, Cliente: ${order.customer_name}, Mensajero: ${order.assigned_messenger_id || 'NO ASIGNADO'}, Método: ${order.delivery_method}, M.Status: ${order.messenger_status}`);
        });

        console.log('\n4. VERIFICACIÓN DE MENSAJEROS DISPONIBLES:');
        const [messengers] = await connection.execute(
            'SELECT id, username, full_name, role FROM users WHERE role = "mensajero" ORDER BY id'
        );
        
        console.log(`   Total mensajeros: ${messengers.length}`);
        messengers.forEach(messenger => {
            console.log(`   - ID: ${messenger.id}, Usuario: ${messenger.username}, Nombre: ${messenger.full_name}`);
        });

        console.log('\n5. PEDIDOS ASIGNADOS A CADA MENSAJERO:');
        for (const messenger of messengers) {
            const [assignedOrders] = await connection.execute(
                'SELECT id, order_number, customer_name, status, messenger_status FROM orders WHERE assigned_messenger_id = ? ORDER BY id',
                [messenger.id]
            );
            
            console.log(`\n   Mensajero: ${messenger.username} (ID: ${messenger.id})`);
            console.log(`   Pedidos asignados: ${assignedOrders.length}`);
            assignedOrders.forEach(order => {
                console.log(`     - Pedido ID: ${order.id} (${order.order_number}) - Cliente: ${order.customer_name} - Status: ${order.status} - M.Status: ${order.messenger_status}`);
            });
        }

        console.log('\n6. POSIBLES PROBLEMAS IDENTIFICADOS:');
        
        // Verificar si hay inconsistencias
        const inconsistencias = [];
        
        // Pedidos en reparto sin mensajero
        const [sinMensajero] = await connection.execute(
            'SELECT COUNT(*) as count FROM orders WHERE status = "en_reparto" AND assigned_messenger_id IS NULL'
        );
        if (sinMensajero[0].count > 0) {
            inconsistencias.push(`${sinMensajero[0].count} pedidos en reparto SIN mensajero asignado`);
        }
        
        // Pedidos asignados a mensajeros inexistentes
        const [mensajerosInexistentes] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM orders o 
            LEFT JOIN users u ON o.assigned_messenger_id = u.id 
            WHERE o.assigned_messenger_id IS NOT NULL 
            AND u.id IS NULL
        `);
        if (mensajerosInexistentes[0].count > 0) {
            inconsistencias.push(`${mensajerosInexistentes[0].count} pedidos asignados a mensajeros que no existen`);
        }

        if (inconsistencias.length > 0) {
            console.log('   ⚠️  PROBLEMAS ENCONTRADOS:');
            inconsistencias.forEach((problema, index) => {
                console.log(`   ${index + 1}. ${problema}`);
            });
        } else {
            console.log('   ✅ No se encontraron inconsistencias en la base de datos');
            console.log('   📝 El problema parece ser en el FRONTEND - la consulta o el display');
        }

        console.log('\n7. VERIFICACIÓN DEL JOIN PARA MOSTRAR MENSAJEROS:');
        const [joinTest] = await connection.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                o.status,
                o.messenger_status,
                o.assigned_messenger_id,
                u.username as messenger_username,
                u.full_name as messenger_full_name
            FROM orders o
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.status = "en_reparto"
            ORDER BY o.id
        `);
        
        console.log('   Query que debería usar el frontend:');
        joinTest.forEach(order => {
            const messengerDisplay = order.messenger_username ? 
                `${order.messenger_username} (${order.messenger_full_name})` : 
                'SIN ASIGNAR';
            console.log(`     - Pedido ${order.id}: ${order.customer_name} → ${messengerDisplay}`);
        });

        await connection.end();
        
        console.log('\n=== CONCLUSIÓN ===');
        console.log('Si el pedido de Ximena (ID: 537) aparece correctamente aquí pero no en el frontend,');
        console.log('el problema está en:');
        console.log('1. La consulta SQL del endpoint de logística');
        console.log('2. La forma como el frontend procesa/muestra los datos');
        console.log('3. Un problema de cache en el frontend');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

diagnosticarProblemaLogistica();
