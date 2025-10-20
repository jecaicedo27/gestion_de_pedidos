const mysql = require('mysql2/promise');

async function checkUsersColumns() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });
    
    try {
        // Verificar columnas de la tabla users
        const [columns] = await connection.execute(`
            SHOW COLUMNS FROM users
        `);
        
        console.log('===========================================');
        console.log('Columnas de la tabla users:');
        console.log('===========================================');
        columns.forEach(col => {
            console.log(`- ${col.Field} (${col.Type})`);
        });
        
        // Buscar el pedido sin joins para ver su estado
        const [order] = await connection.execute(`
            SELECT 
                id,
                order_number,
                customer_name,
                status,
                assigned_messenger_id,
                carrier_id,
                delivery_date
            FROM orders
            WHERE order_number = 'FV-2-13199'
        `);
        
        console.log('\n===========================================');
        console.log('Pedido FV-2-13199 (sin joins):');
        console.log('===========================================');
        if (order.length > 0) {
            console.log('- ID:', order[0].id);
            console.log('- Cliente:', order[0].customer_name);
            console.log('- Estado:', order[0].status);
            console.log('- ID Mensajero asignado:', order[0].assigned_messenger_id);
            console.log('- ID Transportadora:', order[0].carrier_id);
            console.log('- Fecha de entrega:', order[0].delivery_date);
            
            // Si tiene mensajero asignado, buscar su información
            if (order[0].assigned_messenger_id) {
                const [messenger] = await connection.execute(`
                    SELECT * FROM users WHERE id = ?
                `, [order[0].assigned_messenger_id]);
                
                if (messenger.length > 0) {
                    console.log('\nDatos del mensajero asignado:');
                    console.log('- Username:', messenger[0].username);
                    console.log('- Email:', messenger[0].email);
                    console.log('- Role:', messenger[0].role);
                    console.log('- Active:', messenger[0].active);
                }
            } else {
                console.log('\n⚠️  Este pedido NO tiene mensajero asignado');
            }
        } else {
            console.log('Pedido no encontrado');
        }
        
    } finally {
        await connection.end();
    }
}

checkUsersColumns().catch(console.error);
