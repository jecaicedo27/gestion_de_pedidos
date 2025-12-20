
const { query } = require('../config/database');

const analyzeTopInvoice = async () => {
    try {
        console.log('🏆 Finding top profitable invoice for 2025-12-19...');

        // 1. Find the top order
        const topOrderSql = `
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                o.customer_identification,
                o.created_at,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit,
                (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as margin_percent
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at BETWEEN '2025-12-19 00:00:00' AND '2025-12-19 23:59:59'
            AND o.status NOT IN ('cancelado', 'anulado')
            AND o.deleted_at IS NULL
            AND oi.price >= 100
            AND oi.name NOT LIKE '%Flete%'
            GROUP BY o.id
            ORDER BY total_profit DESC
            LIMIT 1;
        `;

        const [topOrder] = await query(topOrderSql);

        if (!topOrder) {
            console.log('No orders found.');
            return;
        }

        console.log(`\n📄 Top Invoice: ${topOrder.order_number} (${topOrder.customer_name})`);
        console.log(`💰 Total Sales: $${Number(topOrder.total_sales).toLocaleString()}`);
        console.log(`💵 Total Profit: $${Number(topOrder.total_profit).toLocaleString()}`);
        console.log(`📈 Net Margin: ${Number(topOrder.margin_percent).toFixed(1)}%`);

        // 2. Breakdown items
        console.log('\n📦 Breakdown of items:');
        const itemsSql = `
            SELECT 
                oi.name,
                oi.quantity,
                oi.price,
                oi.purchase_cost,
                oi.profit_amount,
                ((oi.profit_amount) / (oi.quantity * oi.price)) * 100 as margin
            FROM order_items oi
            WHERE oi.order_id = ?
            AND oi.price >= 100
            AND oi.name NOT LIKE '%Flete%'
            ORDER BY oi.profit_amount DESC;
        `;

        const items = await query(itemsSql, [topOrder.id]);

        console.table(items.map(i => ({
            product: i.name.substring(0, 30),
            qty: i.quantity,
            price: Number(i.price).toLocaleString(),
            cost: Number(i.purchase_cost).toLocaleString(),
            profit: Number(i.profit_amount).toLocaleString(),
            margin: Number(i.margin).toFixed(1) + '%'
        })));

    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
};

analyzeTopInvoice();
