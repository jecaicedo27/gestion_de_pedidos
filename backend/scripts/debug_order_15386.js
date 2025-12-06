
require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugOrder15386() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.payment_method,
        o.total_amount,
        dt.payment_method as tracking_payment_method,
        dt.payment_collected,
        dt.delivered_at,
        cr.id as cash_register_id,
        cr.status as cash_register_status
      FROM orders o
      LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
      LEFT JOIN cash_register cr ON o.id = cr.order_id
      WHERE o.order_number = 'FV-2-15386'
    `);

        console.table(rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugOrder15386();
