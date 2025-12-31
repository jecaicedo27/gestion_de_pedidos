
const { query, poolEnd } = require('../config/database');

async function recalculateProfitability() {
    try {
        console.log('🔄 RECALCULATING PROFITABILITY (Dec 1 - Present)...');
        console.log('Target: Update order_items cost based on CURRENT master product prices.');

        // Fetch items and their NEW master cost
        const sql = `
            SELECT 
                oi.id,
                oi.product_code,
                oi.price,
                oi.quantity,
                oi.discount_percent,
                oi.purchase_cost as old_cost,
                p.purchasing_price as new_cost,
                p.product_name
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.internal_code = oi.product_code
            WHERE o.created_at >= '2025-12-01 00:00:00'
            AND o.status NOT IN ('cancelado', 'anulado')
            AND p.purchasing_price > 0 -- Only update if we have a valid new cost
        `;

        const items = await query(sql);
        console.log(`Found ${items.length} eligible items.`);

        let updatedCount = 0;
        let diffCount = 0;

        for (const item of items) {
            const newCost = parseFloat(item.new_cost);
            const oldCost = parseFloat(item.old_cost || 0);

            // Recalculate if cost changed OR if we want to enforce current prices
            // Validating logic: User said "I put the price without IVA, recalculate".
            // So we trust newCost.

            const unitPrice = parseFloat(item.price);
            const quantity = parseFloat(item.quantity);
            const discount = parseFloat(item.discount_percent) || 0;
            const netUnitPrice = unitPrice * (1 - discount / 100);

            const profitPerUnit = netUnitPrice - newCost;
            const totalProfit = profitPerUnit * quantity;

            // Avoid division by zero
            const profitPercent = netUnitPrice !== 0
                ? ((netUnitPrice - newCost) / netUnitPrice) * 100
                : 0;

            if (Math.abs(newCost - oldCost) > 0.1) {
                diffCount++;
            }

            await query(
                `UPDATE order_items 
                 SET purchase_cost = ?, 
                     profit_amount = ?, 
                     profit_percent = ? 
                 WHERE id = ?`,
                [newCost, totalProfit, profitPercent, item.id]
            );
            updatedCount++;

            if (updatedCount % 500 === 0) process.stdout.write('.');
        }

        console.log('\n\n✅ Recalculation Complete.');
        console.log(`Total Items Processed: ${updatedCount}`);
        console.log(`Items with Cost Changes: ${diffCount}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await poolEnd();
    }
}

recalculateProfitability();
