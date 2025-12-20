
const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

const fixSpike = async () => {
    try {
        console.log('🔧 Fixing zero-cost items for orders from 2025-12-19 onwards...');

        // 1. Identify items to fix
        const findSql = `
            SELECT 
                oi.id as item_id,
                oi.order_id,
                o.order_number,
                oi.name,
                oi.quantity,
                oi.price,
                oi.purchase_cost as current_cost,
                oi.profit_amount as current_profit,
                p.purchasing_price as master_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= '2025-12-19 00:00:00'
            AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
            AND oi.price > 0
            AND p.purchasing_price > 0;
        `;

        const itemsToFix = await query(findSql);

        console.log(`Found ${itemsToFix.length} items to fix.`);

        if (itemsToFix.length === 0) {
            console.log('No items to fix.');
            process.exit(0);
        }

        // 2. Backup
        const backupPath = path.join(__dirname, `backup_profitability_fix_${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(itemsToFix, null, 2));
        console.log(`✅ Backup saved to ${backupPath}`);

        // 3. Update items
        let updatedCount = 0;
        for (const item of itemsToFix) {
            const newCost = Number(item.master_cost);
            const price = Number(item.price);
            const qty = Number(item.quantity);

            const newProfit = (price - newCost) * qty;

            // Update query
            const updateSql = `
                UPDATE order_items 
                SET purchase_cost = ?, 
                    profit_amount = ?
                WHERE id = ?
            `;

            await query(updateSql, [newCost, newProfit, item.item_id]);
            updatedCount++;
            console.log(`Updated Item ${item.item_id} (${item.name}): Cost ${item.current_cost} -> ${newCost}, Profit ${item.current_profit} -> ${newProfit.toFixed(2)}`);
        }

        console.log(`\n🎉 Successfully updated ${updatedCount} items.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
};

fixSpike();
