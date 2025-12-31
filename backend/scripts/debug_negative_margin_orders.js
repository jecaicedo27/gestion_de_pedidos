
require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'gestion_pedidos'
};

async function checkOrderItems() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.\n');

        // Check the 3 problematic orders
        const orderIds = [1017, 1024, 1035]; // FV-2-15705, FV-2-15701, FV-2-15719

        for (const orderId of orderIds) {
            const [orderInfo] = await connection.execute(
                'SELECT order_number, created_at FROM orders WHERE id = ?',
                [orderId]
            );

            console.log(`\n========== Order #${orderId} (${orderInfo[0].order_number}) ==========`);
            console.log(`Created: ${orderInfo[0].created_at}\n`);

            const query = `
                SELECT 
                    id,
                    product_code, 
                    name, 
                    quantity, 
                    price, 
                    discount_percent,
                    purchase_cost, 
                    profit_amount
                FROM order_items 
                WHERE order_id = ?;
            `;

            const [rows] = await connection.execute(query, [orderId]);
            console.table(rows);

            const totalSales = rows.reduce((sum, r) => sum + (r.quantity * (r.price * (1 - (r.discount_percent || 0) / 100))), 0);
            const totalProfit = rows.reduce((sum, r) => sum + parseFloat(r.profit_amount || 0), 0);

            console.log(`Total Sales: $${totalSales.toFixed(2)}`);
            console.log(`Total Profit: $${totalProfit.toFixed(2)}`);
            console.log(`Margin: ${totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(2) : 'N/A'}%`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkOrderItems();
