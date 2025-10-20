const mysql = require('mysql2/promise');

async function checkOrder() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });
    
    try {
        // Verificar el pedido FV-2-13199
        const [order] = await connection.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                o.status,
                o.assigned_messenger_id,
                o.carrier_id,
                o.delivery_date,
                u.first_name as messenger_name,
                u.username as messenger_username,
                c.name as carrier_name
            FROM orders o
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            LEFT JOIN carriers c ON o.carrier_id = c.id
            WHERE o.order_number = 'FV-2-13199'
        `);
        
        console.log('===========================================');
        console.log('Estado actual del pedido FV-2-13199:');
        console.log('===========================================');
        if (order.length > 0) {
            console.log('- ID:', order[0].id);
            console.log('- Cliente:', order[0].customer_name);
            console.log('- Estado:', order[0].status);
            console.log('- ID Mensajero asignado:', order[0].assigned_messenger_id);
            console.log('- Nombre del mensajero:', order[0].messenger_name || 'NO ASIGNADO');
            console.log('- Username del mensajero:', order[0].messenger_username || 'NO ASIGNADO');
            console.log('- Transportadora:', order[0].carrier_name || 'Sin transportadora');
            console.log('- Fecha de entrega:', order[0].delivery_date);
        } else {
            console.log('Pedido no encontrado');
        }
        
        // Verificar todos los mensajeros disponibles
        console.log('\n===========================================');
        console.log('Mensajeros disponibles en el sistema:');
        console.log('===========================================');
        const [messengers] = await connection.execute(`
            SELECT id, first_name, username, role
            FROM users 
            WHERE role = 'mensajero' AND active = 1
        `);
        
        messengers.forEach(m => {
            console.log(`- ID: ${m.id}, Nombre: ${m.first_name}, Username: ${m.username}`);
        });
        
        // Verificar pedidos asignados a mensajeros
        console.log('\n===========================================');
        console.log('Pedidos con mensajeros asignados (últimos 10):');
        console.log('===========================================');
        const [assignedOrders] = await connection.execute(`
            SELECT 
                o.order_number,
                o.customer_name,
                o.status,
                u.first_name as messenger_name
            FROM orders o
            INNER JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.assigned_messenger_id IS NOT NULL
            ORDER BY o.id DESC
            LIMIT 10
        `);
        
        assignedOrders.forEach(o => {
            console.log(`- ${o.order_number}: ${o.customer_name} -> Mensajero: ${o.messenger_name} (Estado: ${o.status})`);
        });
        
        // Verificar específicamente mensajero1
        console.log('\n===========================================');
        console.log('Pedidos asignados a mensajero1:');
        console.log('===========================================');
        const [mensajero1Orders] = await connection.execute(`
            SELECT 
                o.order_number,
                o.customer_name,
                o.status,
                o.created_at
            FROM orders o
            INNER JOIN users u ON o.assigned_messenger_id = u.id
            WHERE u.username = 'mensajero1'
            ORDER BY o.id DESC
            LIMIT 5
        `);
        
        if (mensajero1Orders.length > 0) {
            mensajero1Orders.forEach(o => {
                console.log(`- ${o.order_number}: ${o.customer_name} (Estado: ${o.status})`);
            });
        } else {
            console.log('No hay pedidos asignados a mensajero1');
        }
        
    } finally {
        await connection.end();
    }
}

checkOrder().catch(console.error);
