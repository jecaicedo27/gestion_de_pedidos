
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

        // Check last 3 days
        const query = `
            SELECT 
                DATE(o.created_at) as order_date,
                o.id,
                o.order_number,
                c.name as customer_name,
                o.created_at,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN customers c ON o.customer_identification = c.identification
            WHERE DATE(o.created_at) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            GROUP BY o.id, DATE(o.created_at)
            ORDER BY o.created_at DESC;
        `;

        const [rows] = await connection.execute(query);

        console.log(`\nAnalyzing ${rows.length} orders from last 3 days:\n`);

        // Group by date
        const byDate = {};
        rows.forEach(row => {
            const date = row.order_date.toISOString().split('T')[0];
            if (!byDate[date]) byDate[date] = [];

            const sales = parseFloat(row.total_sales) || 0;
            const profit = parseFloat(row.total_profit) || 0;
            const margin = sales > 0 ? (profit / sales) * 100 : 0;

            byDate[date].push({
                id: row.id,
                order_number: row.order_number,
                customer: row.customer_name,
                sales,
                profit,
                margin: margin.toFixed(2) + '%'
            });
        });

        // Display by date
        Object.keys(byDate).sort().reverse().forEach(date => {
            console.log(`\n========== ${date} ==========`);
            const orders = byDate[date];

            // Sort by margin descending to see outliers
            orders.sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin));

            console.table(orders);

            const totalSales = orders.reduce((sum, o) => sum + o.sales, 0);
            const totalProfit = orders.reduce((sum, o) => sum + o.profit, 0);
            const avgMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

            console.log(`\nDaily Summary:`);
            console.log(`  Sales: $${totalSales.toLocaleString()}`);
            console.log(`  Profit: $${totalProfit.toLocaleString()}`);
            console.log(`  Margin: ${avgMargin.toFixed(2)}%\n`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkProfitability();
