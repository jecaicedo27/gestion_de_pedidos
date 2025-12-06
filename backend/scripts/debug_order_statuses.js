
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkOrderStatuses() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute('SELECT status, COUNT(*) as count FROM orders GROUP BY status');
        console.log('Order counts by status:');
        console.table(rows);

        const [enviadoOrders] = await connection.execute('SELECT id, status, messenger_status FROM orders WHERE status = "enviado" LIMIT 5');
        console.log('Sample "enviado" orders:', enviadoOrders);

        const [repartoOrders] = await connection.execute('SELECT id, status, messenger_status FROM orders WHERE status = "en_reparto" LIMIT 5');
        console.log('Sample "en_reparto" orders:', repartoOrders);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkOrderStatuses();
