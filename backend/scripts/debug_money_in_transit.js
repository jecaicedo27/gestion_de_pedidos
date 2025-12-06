
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkMoneyInTransit() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // 1. Check total payment_collected in delivery_tracking (cash)
        const [totalCollected] = await connection.execute(`
      SELECT COUNT(*) as count, SUM(payment_collected) as total
      FROM delivery_tracking
      WHERE payment_method = 'efectivo'
      AND delivered_at IS NOT NULL
    `);
        console.log('Total Cash Collected (Delivery Tracking):', totalCollected[0]);

        // 2. Check how many of these have cash_register entries
        const [legalized] = await connection.execute(`
      SELECT COUNT(*) as count, SUM(dt.payment_collected) as total
      FROM delivery_tracking dt
      JOIN cash_register cr ON dt.order_id = cr.order_id
      WHERE dt.payment_method = 'efectivo'
      AND dt.delivered_at IS NOT NULL
    `);
        console.log('Legalized Cash (In Cash Register):', legalized[0]);

        // 3. Calculate Money in Transit (Proposed Query)
        const [moneyInTransit] = await connection.execute(`
      SELECT COALESCE(SUM(dt.payment_collected), 0) as amount, COUNT(*) as count
      FROM orders o
      JOIN delivery_tracking dt ON o.id = dt.order_id
      WHERE dt.payment_method = 'efectivo'
      AND dt.delivered_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
    `);
        console.log('Money in Transit (Proposed Calculation):', moneyInTransit[0]);

        // 4. List some orders in transit
        if (moneyInTransit[0].count > 0) {
            const [orders] = await connection.execute(`
        SELECT o.order_number, dt.payment_collected, u.full_name as messenger
        FROM orders o
        JOIN delivery_tracking dt ON o.id = dt.order_id
        LEFT JOIN users u ON dt.messenger_id = u.id
        WHERE dt.payment_method = 'efectivo'
        AND dt.delivered_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
        LIMIT 5
      `);
            console.log('Sample Orders in Transit:', orders);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkMoneyInTransit();
