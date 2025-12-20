const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkOrderItems() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'gestion_pedidos'
    });

    try {
        const [items] = await connection.execute(
            'SELECT id, name, quantity, price FROM order_items WHERE order_id = ?',
            [353]
        );

        console.log('\n=== Items del pedido 353 ===');
        console.log('Total items:', items.length);
        console.log('\nDetalle:');
        items.forEach(item => {
            console.log(`- ${item.name} (Cantidad: ${item.quantity}, Precio: $${item.price})`);
        });

    } finally {
        await connection.end();
    }
}

checkOrderItems().catch(console.error);
