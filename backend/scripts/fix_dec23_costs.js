
const { query, poolEnd } = require('../config/database');

async function fixDec23Costs() {
    try {
        console.log('Starting cost correction for Dec 23 orders...\n');

        // Use the same robust logic as before (Master join)
        // Since we confirmed master_cost is found via simple join, simple SQL update might work,
        // but let's stick to the robust script to be safe.

        const itemsQuery = `
            SELECT 
                oi.id,
                oi.purchase_cost,
                oi.profit_amount,
                oi.quantity,
                oi.price,
                oi.discount_percent,
                p.purchasing_price
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.internal_code = oi.product_code
            WHERE DATE(o.created_at) = '2025-12-23'
            AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
            AND p.purchasing_price > 0
        `;

        const items = await query(itemsQuery);
        console.log(`Found ${items.length} items to fix using direct join.`);

        let updated = 0;
        for (const item of items) {
            const unitCost = parseFloat(item.purchasing_price);
            const unitPrice = parseFloat(item.price);
            const quantity = parseFloat(item.quantity);
            const discount = parseFloat(item.discount_percent) || 0;

            const netUnitPrice = unitPrice * (1 - discount / 100);
            const profitPerUnit = netUnitPrice - unitCost;
            const totalProfit = profitPerUnit * quantity;

            await query(
                `UPDATE order_items 
                 SET purchase_cost = ?, 
                     profit_amount = ? 
                 WHERE id = ?`,
                [unitCost, totalProfit, item.id]
            );
            updated++;
        }

        console.log(`✅ Successfully updated ${updated} items.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

fixDec23Costs();
