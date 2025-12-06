
require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugMoneyInTransit() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Query to get details of orders in "Money in Transit"
        const [rows] = await connection.execute(`
      SELECT 
        o.order_number,
        o.payment_method as order_payment_method,
        o.total_amount,
        dt.payment_method as tracking_payment_method,
        dt.payment_collected,
        dt.delivered_at
      FROM orders o
      JOIN delivery_tracking dt ON o.id = dt.order_id
      WHERE dt.payment_method = 'efectivo'
      AND dt.delivered_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
      ORDER BY dt.payment_collected DESC
      LIMIT 20
    `);

        console.log('Orders contributing to Money in Transit (Top 20 by amount):');
        console.table(rows);

        // Summary stats
        const [stats] = await connection.execute(`
      SELECT 
        o.payment_method as order_payment_method,
        COUNT(*) as count,
        SUM(dt.payment_collected) as total_collected
      FROM orders o
      JOIN delivery_tracking dt ON o.id = dt.order_id
      WHERE dt.payment_method = 'efectivo'
      AND dt.delivered_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
      GROUP BY o.payment_method
    `);
        console.log('\nSummary by Order Payment Method:');
        console.table(stats);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugMoneyInTransit();
