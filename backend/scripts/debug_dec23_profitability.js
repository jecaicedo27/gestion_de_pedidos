
const { query, poolEnd } = require('../config/database');

async function checkTodayOrders() {
    try {
        console.log('Checking orders for Dec 23rd...\n');

        const itemsQuery = `
            SELECT 
                o.created_at,
                o.order_number,
                o.payment_method,
                oi.product_code,
                oi.name,
                oi.quantity,
                oi.price,
                oi.purchase_cost,
                oi.profit_amount,
                p.purchasing_price as master_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE DATE(o.created_at) = '2025-12-23'
            AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
            ORDER BY o.created_at DESC
        `;

        const items = await query(itemsQuery);

        if (items.length === 0) {
            console.log('No items found with purchase_cost = 0 for today.');

            // If no zero cost items, check high margin orders anyway
            const highMarginQuery = `
                SELECT 
                    o.order_number,
                    SUM(oi.profit_amount) as total_profit,
                    SUM(oi.quantity * oi.price) as total_sales,
                    (SUM(oi.profit_amount) / SUM(oi.quantity * oi.price) * 100) as margin_percent
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE DATE(o.created_at) = '2025-12-23'
                GROUP BY o.id
                HAVING margin_percent > 60
                ORDER BY margin_percent DESC
            `;
            const highMargin = await query(highMarginQuery);
            if (highMargin.length > 0) {
                console.log('\nFound orders with unusually high margin (>60%):');
                console.table(highMargin);
            } else {
                console.log('No high margin orders found either. The spike might be from something else.');
            }

        } else {
            console.log(`Found ${items.length} items with purchase_cost = 0:`);
            console.table(items.map(i => ({
                order: i.order_number,
                code: i.product_code,
                name: i.name,
                price: i.price,
                cost_db: i.purchase_cost,
                cost_master: i.master_cost
            })));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

checkTodayOrders();
