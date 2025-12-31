
const { query, poolEnd } = require('../config/database');

async function fixOrderItemsCosts() {
    try {
        console.log('Starting cost correction for Dec 20 orders...\n');

        // Get all order items from Dec 20 with purchase_cost = 0
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
                p.purchasing_price,
                p.product_name
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE DATE(o.created_at) = '2025-12-20'
            AND oi.purchase_cost = 0
            AND p.purchasing_price > 0
        `;

        const items = await query(itemsQuery);

        console.log(`Found ${items.length} items with missing purchase_cost:\n`);

        if (items.length === 0) {
            console.log('No items to fix!');
            await poolEnd();
            return;
        }

        console.table(items.map(i => ({
            id: i.id,
            order: i.order_id,
            code: i.product_code,
            qty: i.quantity,
            price: i.price,
            current_cost: i.purchase_cost,
            master_cost: i.purchasing_price
        })));

        console.log('\nUpdating costs and recalculating profit...\n');

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

            console.log(`✓ Item ${item.id}: cost ${unitCost.toFixed(2)}, profit ${totalProfit.toFixed(2)}`);
            updated++;
        }

        console.log(`\n✅ Successfully updated ${updated} items!`);

        // Show summary
        console.log('\n--- VERIFICATION ---');
        const verification = await query(`
            SELECT 
                o.order_number,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as sales,
                SUM(oi.profit_amount) as profit
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE DATE(o.created_at) = '2025-12-20'
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND oi.price >= 30
            AND o.payment_method != 'reposicion'
            GROUP BY o.id
        `);

        const totalSales = verification.reduce((sum, r) => sum + parseFloat(r.sales), 0);
        const totalProfit = verification.reduce((sum, r) => sum + parseFloat(r.profit), 0);
        const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

        console.log(`Total Sales: $${totalSales.toLocaleString()}`);
        console.log(`Total Profit: $${totalProfit.toLocaleString()}`);
        console.log(`Margin: ${margin.toFixed(2)}%`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

fixOrderItemsCosts();
