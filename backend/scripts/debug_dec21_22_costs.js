
const { query, poolEnd } = require('../config/database');

async function checkRecentOrders() {
    try {
        console.log('Checking orders for Dec 21st and 22nd...\n');

        const itemsQuery = `
            SELECT 
                o.created_at,
                o.order_number,
                oi.purchase_cost,
                oi.price,
                oi.product_code,
                oi.name,
                oi.quantity,
                p.purchasing_price as master_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE o.created_at >= '2025-12-21 00:00:00'
            AND oi.purchase_cost = 0
            ORDER BY o.created_at DESC
        `;

        const items = await query(itemsQuery);

        if (items.length === 0) {
            console.log('No items found with purchase_cost = 0 for this period.');
        } else {
            console.log(`Found ${items.length} items with purchase_cost = 0:`);
            console.table(items.map(i => ({
                date: new Date(i.created_at).toLocaleString(),
                order: i.order_number,
                code: i.product_code,
                price: parseFloat(i.price).toFixed(2),
                cost_in_db: i.purchase_cost,
                cost_in_master: parseFloat(i.master_cost).toFixed(2)
            })));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

checkRecentOrders();
