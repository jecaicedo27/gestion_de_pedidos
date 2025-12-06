
require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugEnReparto() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Check orders in 'en_reparto'
        const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.payment_method,
        o.total_amount,
        dt.id as tracking_id,
        dt.payment_collected,
        dt.delivered_at
      FROM orders o
      LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
      WHERE o.status = 'en_reparto'
      AND o.payment_method = 'efectivo'
      LIMIT 10
    `);

        console.log('Orders in "en_reparto" (Cash):');
        console.table(orders);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugEnReparto();
