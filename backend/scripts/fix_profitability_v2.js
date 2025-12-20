
const { query } = require('../config/database');

const fixProfitabilityV2 = async () => {
    try {
        console.log('🔧 Recalculating profit with discounts for recent orders (from 2025-12-18)...');

        // Fetch items from Dec 18 onwards
        const sql = `
            SELECT 
                id, 
                name, 
                quantity, 
                price, 
                purchase_cost, 
                discount_percent, 
                profit_amount 
            FROM order_items 
            WHERE created_at >= '2025-12-18 00:00:00'
        `;

        const items = await query(sql);
        console.log(`Found ${items.length} items to check.`);

        let count = 0;
        let diffSum = 0;

        for (const item of items) {
            const price = Number(item.price);
            const cost = Number(item.purchase_cost);
            const qty = Number(item.quantity);
            const discount = Number(item.discount_percent || 0);

            // Correct Formula: Net Price = Price * (1 - Discount/100)
            const netPriceUnit = price * (1 - discount / 100);

            // Profit = (Net Price Unit - Cost Unit) * Quantity
            const newProfit = (netPriceUnit - cost) * qty;

            const currentProfit = Number(item.profit_amount);

            // Only update if difference > 50 pesos (ignore small rounding diffs)
            if (Math.abs(newProfit - currentProfit) > 50) {
                await query('UPDATE order_items SET profit_amount = ? WHERE id = ?', [newProfit, item.id]);
                console.log(`UPDATE Item ${item.id} (${item.name})`);
                console.log(`   Price: ${price}, Disc: ${discount}%, Cost: ${cost}, Qty: ${qty}`);
                console.log(`   Old Profit: ${currentProfit.toFixed(0)} -> New Profit: ${newProfit.toFixed(0)}`);
                console.log('---------------------------------------------------');
                count++;
                diffSum += (currentProfit - newProfit); // Positive means we reduced the profit (corrected inflation)
            }
        }

        console.log(`\n✅ Successfully updated ${count} items.`);
        console.log(`📉 Total Overestimated Profit Removed: $${diffSum.toLocaleString()}`);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};

fixProfitabilityV2();
