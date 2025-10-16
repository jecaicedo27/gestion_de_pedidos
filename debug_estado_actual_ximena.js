const mysql = require('mysql2/promise');

async function checkCurrentState() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        console.log('=== VERIFICANDO ESTADO ACTUAL ===\n');
        
        // Buscar todos los pedidos de Ximena
        const [ximenadOrders] = await connection.execute(
            'SELECT id, client_name, status, messenger_status, assigned_messenger_id FROM orders WHERE client_name LIKE ?',
            ['%XIMENA%']
        );
        
        console.log('Pedidos de Ximena encontrados:', ximenadOrders.length);
        ximenadOrders.forEach(order => {
            console.log(`- ID: ${order.id}, Cliente: ${order.client_name}, Status: ${order.status}, Messenger Status: ${order.messenger_status}, Assigned Messenger: ${order.assigned_messenger_id}`);
        });

        console.log('\n=== PEDIDOS EN REPARTO SIN MENSAJERO ===');
        
        // Buscar pedidos en reparto sin mensajero asignado
        const [problematicOrders] = await connection.execute(
            'SELECT id, client_name, status, messenger_status, assigned_messenger_id FROM orders WHERE status = "en_reparto" AND assigned_messenger_id IS NULL'
        );
        
        console.log('Pedidos problemáticos encontrados:', problematicOrders.length);
        problematicOrders.forEach(order => {
            console.log(`- ID: ${order.id}, Cliente: ${order.client_name}, Status: ${order.status}, Messenger Status: ${order.messenger_status}`);
        });

        console.log('\n=== VERIFICANDO MENSAJEROS ===');
        
        // Verificar mensajeros disponibles
        const [messengers] = await connection.execute(
            'SELECT id, username, role FROM users WHERE role = "mensajero"'
        );
        
        console.log('Mensajeros encontrados:', messengers.length);
        messengers.forEach(messenger => {
            console.log(`- ID: ${messenger.id}, Usuario: ${messenger.username}, Rol: ${messenger.role}`);
        });

        console.log('\n=== PEDIDOS ASIGNADOS A CADA MENSAJERO ===');
        
        // Ver qué pedidos tiene cada mensajero
        for (const messenger of messengers) {
            const [assignedOrders] = await connection.execute(
                'SELECT id, client_name, status, messenger_status FROM orders WHERE assigned_messenger_id = ?',
                [messenger.id]
            );
            
            console.log(`Mensajero ${messenger.username} (ID: ${messenger.id}) tiene ${assignedOrders.length} pedidos asignados:`);
            assignedOrders.forEach(order => {
                console.log(`  - Pedido ID: ${order.id}, Cliente: ${order.client_name}, Status: ${order.status}, Messenger Status: ${order.messenger_status}`);
            });
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkCurrentState();
