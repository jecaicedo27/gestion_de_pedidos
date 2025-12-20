const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function fix() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: process.env.DB_USER || 'gestion_user',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'gestion_pedidos'
    });

    console.log('🚀 Starting Profitability Fix V3 (Cost + Formula)...');

    try {
        // 1. Fix Zero Costs from Products table
        // We look for items created since Dec 18 that have 0 cost
        const [zeroCostItems] = await connection.execute(`
            SELECT oi.id, oi.name, oi.purchase_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= '2025-12-18 00:00:00'
            AND (oi.purchase_cost IS NULL OR oi.purchase_cost = 0)
        `);

        if (zeroCostItems.length > 0) {
            console.log(`found ${zeroCostItems.length} items with 0 cost. Attempting to fix...`);

            for (const item of zeroCostItems) {
                // Find cost in products table
                const [productRows] = await connection.execute(
                    'SELECT purchasing_price FROM products WHERE product_name = ? LIMIT 1',
                    [item.name]
                );

                if (productRows.length > 0) {
                    const cost = productRows[0].purchasing_price;
                    if (cost > 0) {
                        await connection.execute(
                            'UPDATE order_items SET purchase_cost = ? WHERE id = ?',
                            [cost, item.id]
                        );
                        console.log(`✅ Updated cost for ${item.name}: ${cost}`);
                    } else {
                        console.warn(`⚠️ Product ${item.name} has 0 cost in master table too.`);
                    }
                } else {
                    console.warn(`⚠️ Product ${item.name} not found in products table.`);
                }
            }
        } else {
            console.log('✅ No zero-cost items found.');
        }

        // 2. Recalculate Profit for ALL items since Dec 18 (to ensure formula is applied to the newly fixed costs)
        const [allItems] = await connection.execute(`
            SELECT oi.id, oi.name, oi.price, oi.purchase_cost, oi.quantity, oi.profit_amount, oi.discount_percent
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= '2025-12-18 00:00:00'
        `);

        let updatedCount = 0;
        for (const item of allItems) {
            const price = Number(item.price || 0);
            const cost = Number(item.purchase_cost || 0);
            const qty = Number(item.quantity || 0);
            const discount = Number(item.discount_percent || 0);
            const currentProfit = Number(item.profit_amount || 0);

            // Formula: (Price * (1 - Discount) - Cost) * Qty
            const priceAfterDiscount = price * (1 - (discount / 100));
            const unitProfit = priceAfterDiscount - cost;
            const totalProfit = unitProfit * qty;

            if (Math.abs(totalProfit - currentProfit) > 50) { // Tolerance of 50 pesos
                await connection.execute(
                    'UPDATE order_items SET profit_amount = ? WHERE id = ?',
                    [totalProfit, item.id]
                );
                // We don't strictly update profit_percent column as the chart calculates it dynamicallly, 
                // but for consistency we could (formula: totalProfit / (Revenue) * 100)
                // Let's just fix the amount which is the source of truth for the chart query.
                updatedCount++;
            }
        }

        console.log(`✅ Recalculated profit for ${updatedCount} items.`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await connection.end();
    }
}

fix();
