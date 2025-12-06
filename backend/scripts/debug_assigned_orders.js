
require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugAssignedOrders() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Check orders assigned to a messenger but not delivered
        const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.messenger_status,
        o.payment_method,
        o.total_amount,
        dt.payment_collected
      FROM orders o
      LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
      WHERE o.assigned_messenger_id IS NOT NULL
      AND o.status NOT IN ('entregado', 'entregado_cliente', 'entregado_bodega', 'finalizado', 'completado')
      AND o.payment_method = 'efectivo'
      LIMIT 10
    `);

        console.log('Orders assigned to messenger (Cash, Not Delivered):');
        console.table(orders);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugAssignedOrders();
