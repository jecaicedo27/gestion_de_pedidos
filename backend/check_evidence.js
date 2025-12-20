const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });

async function checkOrder() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await connection.execute(
        'SELECT id, order_number, payment_method, payment_evidence_path FROM orders WHERE order_number = ?',
        ['FV-2-15261']
    );

    console.log(JSON.stringify(rows, null, 2));
    await connection.end();
}

checkOrder().catch(console.error);
