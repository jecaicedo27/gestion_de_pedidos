
require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugMoneyInTransitBreakdown() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Execute the EXACT query used in the controller, but selecting details instead of SUM
        const [rows] = await connection.execute(`
      SELECT 
        o.order_number,
        o.status,
        o.payment_method,
        o.delivery_method,
        o.total_amount,
        o.created_at,
        dt.payment_collected,
        dt.delivered_at,
        CASE 
           WHEN dt.delivered_at IS NOT NULL THEN dt.payment_collected 
           ELSE o.total_amount 
        END as contribution_amount
      FROM orders o
      LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
      WHERE o.payment_method = 'efectivo'
      AND o.status != 'anulado'
      AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
      AND (
        (dt.delivered_at IS NOT NULL AND dt.payment_collected > 0)
        OR
        (dt.delivered_at IS NULL AND (o.assigned_messenger_id IS NOT NULL OR o.delivery_method = 'recoge_bodega') 
         AND o.status NOT IN ('entregado', 'entregado_cliente', 'entregado_bodega', 'finalizado', 'completado', 'anulado'))
      )
      ORDER BY contribution_amount DESC
    `);

        console.log(`Total Orders: ${rows.length}`);
        const total = rows.reduce((sum, row) => sum + parseFloat(row.contribution_amount || 0), 0);
        console.log(`Total Amount: ${total.toLocaleString()}`);

        console.log('\nTop 20 Contributors:');
        console.table(rows.slice(0, 20));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugMoneyInTransitBreakdown();
