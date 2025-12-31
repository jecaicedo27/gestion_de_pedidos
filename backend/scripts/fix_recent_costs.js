
const { query, poolEnd } = require('../config/database');

async function fixRecentCosts() {
    try {
        console.log('Starting cost correction for orders from Dec 21st onwards...\n');

        // Get all order items from Dec 21 onwards with purchase_cost = 0
        const itemsQuery = `
            SELECT 
                oi.id,
                oi.order_id,
                oi.product_code,
                oi.name,
                oi.quantity,
                oi.price,
                oi.discount_percent,
                oi.purchase_cost,
                oi.profit_amount,
                COALESCE(p.purchasing_price, 0) as purchasing_price,
                p.product_name
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE o.created_at >= '2025-12-21 00:00:00'
            AND oi.purchase_cost = 0
            AND p.purchasing_price > 0
        `;

        const items = await query(itemsQuery);

        console.log(`Found ${items.length} items with missing purchase_cost that can be fixed from master:\n`);

        if (items.length === 0) {
            console.log('No items to fix!');
            await poolEnd();
            return;
        }

        let updated = 0;
        for (const item of items) {
            const unitCost = parseFloat(item.purchasing_price);
            const unitPrice = parseFloat(item.price);
            const quantity = parseFloat(item.quantity);
            const discount = parseFloat(item.discount_percent) || 0;

            // Calculate net unit price after discount
            const netUnitPrice = unitPrice * (1 - discount / 100);

            // Calculate profit per unit
            const profitPerUnit = netUnitPrice - unitCost;

            // Calculate total profit
            const totalProfit = profitPerUnit * quantity;

            await query(
                `UPDATE order_items 
                 SET purchase_cost = ?, 
                     profit_amount = ? 
                 WHERE id = ?`,
                [unitCost, totalProfit, item.id]
            );

            // Log every 50 updates to avoid spam
            if (updated % 50 === 0) {
                console.log(`Updated ${updated} items...`);
            }
            updated++;
        }

        console.log(`\n✅ Successfully updated ${updated} items!`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

fixRecentCosts();
