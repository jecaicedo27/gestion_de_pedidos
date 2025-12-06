
require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugOrder15386Closing() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute(`
      SELECT 
        o.order_number,
        ccd.id as detail_id,
        ccd.closing_id,
        ccd.collection_status,
        ccd.collected_amount,
        mcc.status as closing_status
      FROM orders o
      LEFT JOIN cash_closing_details ccd ON o.id = ccd.order_id
      LEFT JOIN messenger_cash_closings mcc ON ccd.closing_id = mcc.id
      WHERE o.order_number = 'FV-2-15386'
    `);

        console.table(rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugOrder15386Closing();
