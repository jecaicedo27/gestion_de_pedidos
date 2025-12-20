
const { query } = require('../config/database');

const compareDates = async () => {
    try {
        const dates = ['2025-12-18', '2025-12-19'];

        for (const date of dates) {
            console.log(`\n📊 Analyzing breakdown for: ${date}`);

            // 1. Overall stats
            const overallSql = `
                SELECT 
                    SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                    SUM(oi.profit_amount) as total_profit,
                    (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as margin_percent
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE o.created_at BETWEEN '${date} 00:00:00' AND '${date} 23:59:59'
                AND o.status NOT IN ('cancelado', 'anulado')
                AND o.deleted_at IS NULL
                AND oi.price >= 100
                AND oi.name NOT LIKE '%Flete%';
            `;

            const [overall] = await query(overallSql);
            console.log(`Totals -> Sales: $${Number(overall.total_sales).toLocaleString()}, Profit: $${Number(overall.total_profit).toLocaleString()}, Margin: ${Number(overall.margin_percent).toFixed(1)}%`);

            // 2. Top products by Profit
            const productSql = `
                SELECT 
                    oi.name,
                    SUM(oi.quantity) as qty,
                    SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as sales,
                    SUM(oi.profit_amount) as profit,
                    (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as margin
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE o.created_at BETWEEN '${date} 00:00:00' AND '${date} 23:59:59'
                AND o.status NOT IN ('cancelado', 'anulado')
                AND o.deleted_at IS NULL
                AND oi.price >= 100
                AND oi.name NOT LIKE '%Flete%'
                GROUP BY oi.name
                ORDER BY profit DESC
                LIMIT 10;
            `;

            const products = await query(productSql);
            console.log('Top 10 Products by Profit:');
            console.table(products.map(p => ({
                name: p.name.substring(0, 30),
                qty: p.qty,
                sales: Number(p.sales).toLocaleString(),
                profit: Number(p.profit).toLocaleString(),
                margin: Number(p.margin).toFixed(1) + '%'
            })));
        }

    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
};

compareDates();
