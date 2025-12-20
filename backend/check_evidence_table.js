const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });

async function checkTable() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // Check if table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'payment_evidences'");
    console.log('Tables found:', tables);

    if (tables.length > 0) {
        // Check for evidence for order ID 100 (FV-2-15261)
        const [rows] = await connection.execute(
            'SELECT * FROM payment_evidences WHERE order_id = ?',
            [100]
        );
        console.log('Evidence rows for order 100:', JSON.stringify(rows, null, 2));
    } else {
        console.log('payment_evidences table does not exist.');
    }

    await connection.end();
}

checkTable().catch(console.error);
