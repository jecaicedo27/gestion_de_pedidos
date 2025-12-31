
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
        console.log('Connected to database.\n');

        // Query with the same filters as the endpoint
        const query = `
            SELECT 
                o.id,
                o.order_number,
                o.payment_method,
                c.name as customer_name,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN customers c ON o.customer_identification = c.identification
            WHERE DATE(o.created_at) = '2025-12-19'
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.deleted_at IS NULL
            AND oi.price >= 30
            AND o.payment_method != 'reposicion'
            GROUP BY o.id
            ORDER BY o.created_at DESC;
        `;

        const [rows] = await connection.execute(query);

        console.log(`Analyzing ${rows.length} orders for 2025-12-19 with NEW filters:\n`);
        console.log('Filters applied:');
        console.log('  - status NOT IN (cancelado, anulado, gestion_especial)');
        console.log('  - deleted_at IS NULL');
        console.log('  - price >= 30');
        console.log('  - payment_method != reposicion\n');

        const results = rows.map(row => {
            const sales = parseFloat(row.total_sales) || 0;
            const profit = parseFloat(row.total_profit) || 0;
            const margin = sales > 0 ? (profit / sales) * 100 : 0;

            return {
                id: row.id,
                order_number: row.order_number,
                payment_method: row.payment_method,
                customer: row.customer_name,
                sales,
                profit,
                margin: margin.toFixed(2) + '%'
            };
        });

        // Sort by highest margin to see outliers
        results.sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin));

        console.table(results);

        const totalSales = results.reduce((sum, o) => sum + o.sales, 0);
        const totalProfit = results.reduce((sum, o) => sum + o.profit, 0);
        const avgMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

        console.log('\n--- DAILY SUMMARY ---');
        console.log(`Total Sales: $${totalSales.toLocaleString()}`);
        console.log(`Total Profit: $${totalProfit.toLocaleString()}`);
        console.log(`Weighted Margin: ${avgMargin.toFixed(2)}%`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkProfitability();
