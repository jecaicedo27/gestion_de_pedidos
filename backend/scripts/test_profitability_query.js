
const { query } = require('../config/database');

async function testQuery() {
    try {
        const startDate = '2025-12-01';
        const endDate = '2025-12-31 23:59:59';
        const dateFormat = '%Y-%m-%d';

        const queryStr = `
            SELECT 
                DATE_FORMAT(o.created_at, '${dateFormat}') as date_label,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.deleted_at IS NULL
            AND oi.price >= 30
            AND o.payment_method != 'reposicion'
            GROUP BY date_label
            ORDER BY date_label ASC
        `;

        const results = await query(queryStr, [startDate, endDate]);

        // Calculate margin in JavaScript
        const formattedData = results.map(row => {
            const sales = Number(row.total_sales) || 0;
            const profit = Number(row.total_profit) || 0;
            const margin = sales > 0 ? (profit / sales) * 100 : 0;

            return {
                date: row.date_label,
                sales,
                profit,
                margin: parseFloat(margin.toFixed(1))
            };
        });

        // Filter for Dec 17-20
        const filtered = formattedData.filter(d => d.date >= '2025-12-17' && d.date <= '2025-12-20');

        console.log('\nData for Dec 17-20 (from actual query):');
        console.table(filtered);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testQuery();
