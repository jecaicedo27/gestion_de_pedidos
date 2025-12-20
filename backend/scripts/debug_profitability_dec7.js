
require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'gestion_pedidos'
};

async function checkProfitability() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const query = `
            SELECT 
                o.id,
                o.order_number,
                c.name as customer_name,
                o.created_at,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN customers c ON o.customer_identification = c.identification
            WHERE DATE(o.created_at) = '2025-12-07'
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            GROUP BY o.id
            ORDER BY o.created_at ASC;
        `;

        const [rows] = await connection.execute(query);

        console.log(`Analyzing ${rows.length} orders for 2025-12-07:\n`);

        let dailySales = 0;
        let dailyProfit = 0;

        const results = rows.map(row => {
            const sales = parseFloat(row.total_sales) || 0;
            const profit = parseFloat(row.total_profit) || 0;
            const margin = sales > 0 ? (profit / sales) * 100 : 0;

            dailySales += sales;
            dailyProfit += profit;

            return {
                id: row.id,
                order_number: row.order_number,
                customer: row.customer_name,
                sales,
                profit,
                margin: margin.toFixed(2) + '%'
            };
        });

        // Sort by lowest margin first
        results.sort((a, b) => parseFloat(a.margin) - parseFloat(b.margin));

        console.table(results);

        const dailyMargin = dailySales > 0 ? (dailyProfit / dailySales) * 100 : 0;
        console.log('\n--- DAILY SUMMARY ---');
        console.log(`Total Sales: $${dailySales.toLocaleString()}`);
        console.log(`Total Profit: $${dailyProfit.toLocaleString()}`);
        console.log(`Weighted Margin: ${dailyMargin.toFixed(2)}%`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkProfitability();
