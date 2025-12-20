const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const analyzeDrops = async () => {
    try {
        const dates = ['2025-12-05', '2025-12-07'];

        for (const date of dates) {
            console.log(`\n--- ANALYSIS FOR ${date} ---`);
            const [orders] = await pool.query(`
                SELECT 
                    o.id, 
                    o.order_number,
                    c.name as customer_name,
                    SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as net_sales,
                    SUM(oi.profit_amount) as total_profit,
                    (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as margin_percent
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN customers c ON o.customer_identification = c.identification
                WHERE DATE(o.created_at) = ?
                AND o.status NOT IN ('cancelado', 'anulado')
                GROUP BY o.id
                ORDER BY margin_percent ASC
            `, [date]);

            if (orders.length === 0) {
                console.log("No orders found.");
            } else {
                console.table(orders.map(o => ({
                    ID: o.id,
                    OrderNum: o.order_number,
                    Customer: o.customer_name,
                    Sales: Number(o.net_sales).toFixed(2),
                    Profit: Number(o.total_profit).toFixed(2),
                    'Margin %': Number(o.margin_percent).toFixed(2) + '%'
                })));
            }
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

analyzeDrops();
