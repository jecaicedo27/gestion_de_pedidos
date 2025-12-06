
require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugGetOrdersSimulation() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Simulate the WHERE clause generated in getOrders for status='money_in_transit'
        const whereClause = `
      WHERE o.deleted_at IS NULL
      AND o.id IN (
        SELECT dt.order_id 
        FROM delivery_tracking dt 
        WHERE dt.payment_method = 'efectivo' 
        AND dt.payment_collected > 0
        AND dt.delivered_at IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = dt.order_id)
        UNION
        SELECT o2.id
        FROM orders o2
        WHERE o2.payment_method = 'efectivo'
        AND o2.status != 'anulado'
        AND (o2.assigned_messenger_id IS NOT NULL OR o2.delivery_method = 'recoge_bodega')
        AND o2.status NOT IN ('entregado', 'entregado_cliente', 'entregado_bodega', 'finalizado', 'completado', 'anulado')
      )
    `;

        const [rows] = await connection.execute(`
      SELECT o.order_number, o.status, o.total_amount, o.created_at
      FROM orders o
      ${whereClause}
      ORDER BY o.created_at DESC
    `);

        console.log(`Total Orders returned by getOrders simulation: ${rows.length}`);
        console.table(rows);

        // Check if FV-2-15386 is in the list
        const found = rows.find(r => r.order_number === 'FV-2-15386');
        console.log('FV-2-15386 found:', !!found);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugGetOrdersSimulation();
