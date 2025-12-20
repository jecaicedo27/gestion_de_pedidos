const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });

async function checkOrder() {
    console.log('Connecting to DB...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Querying order FV-1-131...');
        const [rows] = await connection.execute(
            'SELECT id, order_number, product_evidence_photo, payment_evidence_photo, cash_evidence_photo, status FROM orders WHERE order_number = ?',
            ['FV-1-131']
        );
        console.log('Result:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
        console.log('Done.');
        process.exit(0);
    }
}

checkOrder();
