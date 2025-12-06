
require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugMoneyInTransitLogic() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const targetOrderNumbers = ['FV-2-15430', 'FV-2-15450', 'FV-2-15451', 'FV-2-15446'];

        // 1. Check details of the specific orders
        const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.payment_method,
        o.delivery_method,
        o.total_amount,
        o.assigned_messenger_id,
        m.full_name as messenger_name,
        dt.payment_collected,
        dt.delivered_at,
        (SELECT COUNT(*) FROM cash_register cr WHERE cr.order_id = o.id) as in_cash_register
      FROM orders o
      LEFT JOIN users m ON o.assigned_messenger_id = m.id
      LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
      WHERE o.order_number IN (${targetOrderNumbers.map(n => `'${n}'`).join(',')})
    `);

        console.log('Target Orders Details:');
        console.table(orders);

        // 2. Test Proposed Query
        const [proposed] = await connection.execute(`
      SELECT 
        o.order_number,
        COALESCE(NULLIF(dt.payment_collected, 0), o.total_amount) as calculated_amount
      FROM orders o
      LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
      WHERE o.payment_method = 'efectivo'
      AND o.status != 'anulado'
      AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
      AND (
        o.assigned_messenger_id IS NOT NULL 
        OR 
        o.delivery_method = 'recoge_bodega'
        OR
        dt.id IS NOT NULL
      )
      AND o.order_number IN (${targetOrderNumbers.map(n => `'${n}'`).join(',')})
    `);

        console.log('\nCaptured by Proposed Query:');
        console.table(proposed);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugMoneyInTransitLogic();
