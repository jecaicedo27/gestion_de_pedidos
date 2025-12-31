const { query, poolEnd } = require('../config/database');

function sanitizeText(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

async function backfillDec23() {
    try {
        console.log('═══════════════════════════════════════════════════════');
        console.log(' BACKFILL V2: Dec 23 Purchase Costs');
        console.log('═══════════════════════════════════════════════════════\n');

        // Step 1: Get all items with zero cost from Dec 23
        const itemsQuery = `
            SELECT 
                oi.id,
                oi.product_code,
                oi.name,
                oi.quantity,
                oi.price,
                oi.discount_percent,
                oi.purchase_cost as current_cost,
                p.purchasing_price as master_cost,
                p.product_name as master_name
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE DATE(o.created_at) = '2025-12-23'
            AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
            AND oi.product_code NOT IN ('FL01', 'PROPINA') -- Valid exemptions
            ORDER BY oi.id
        `;

        const items = await query(itemsQuery);
        console.log(`📋 Found ${items.length} items with zero cost on Dec 23\n`);

        if (items.length === 0) {
            console.log('✅ No items to fix!');
            await poolEnd();
            return;
        }

        // Step 2: Build cost map from products table
        const products = await query('SELECT internal_code, product_name, purchasing_price FROM products WHERE purchasing_price > 0');
        const costMap = new Map();

        products.forEach(p => {
            if (p.internal_code) {
                costMap.set(`CODE:${p.internal_code}`, parseFloat(p.purchasing_price));
                costMap.set(`CODE:${sanitizeText(p.internal_code)}`, parseFloat(p.purchasing_price));
            }
            if (p.product_name) {
                costMap.set(`NAME:${sanitizeText(p.product_name)}`, parseFloat(p.purchasing_price));
            }
        });

        console.log(`💰 Loaded ${costMap.size} cost lookups from master\n`);

        // Step 3: Process each item
        let updated = 0;
        let notFound = 0;
        const notFoundItems = [];

        for (const item of items) {
            const rawCode = item.product_code;
            const itemName = sanitizeText(item.name);

            // Try multiple lookup strategies
            let masterCost = 0;

            // Strategy 1: Exact code match
            if (rawCode && costMap.has(`CODE:${rawCode}`)) {
                masterCost = costMap.get(`CODE:${rawCode}`);
            }
            // Strategy 2: Sanitized code match
            else if (rawCode && costMap.has(`CODE:${sanitizeText(rawCode)}`)) {
                masterCost = costMap.get(`CODE:${sanitizeText(rawCode)}`);
            }
            // Strategy 3: Name match
            else if (costMap.has(`NAME:${itemName}`)) {
                masterCost = costMap.get(`NAME:${itemName}`);
            }
            // Strategy 4: Direct master_cost if available
            else if (item.master_cost && parseFloat(item.master_cost) > 0) {
                masterCost = parseFloat(item.master_cost);
            }

            if (masterCost > 0) {
                const unitCost = masterCost;
                const unitPrice = parseFloat(item.price);
                const quantity = parseFloat(item.quantity);
                const discount = parseFloat(item.discount_percent) || 0;

                const netUnitPrice = unitPrice * (1 - discount / 100);
                const profitPerUnit = netUnitPrice - unitCost;
                const totalProfit = profitPerUnit * quantity;
                const profitPercent = netUnitPrice > 0 ? ((netUnitPrice - unitCost) / netUnitPrice) * 100 : 0;

                await query(
                    `UPDATE order_items 
                     SET purchase_cost = ?, 
                         profit_amount = ?,
                         profit_percent = ?
                     WHERE id = ?`,
                    [unitCost, totalProfit, profitPercent, item.id]
                );

                updated++;
                /* if (updated % 20 === 0) console.log(`✓ Updated ${updated} items...`); */
            } else {
                notFound++;
                notFoundItems.push({
                    code: item.product_code,
                    name: item.name
                });
            }
        }

        console.log('\n═══════════════════════════════════════════════════════');
        console.log(' RESULTS');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`✅ Successfully updated: ${updated} items`);
        console.log(`⚠️  No cost found: ${notFound} items\n`);

        if (notFoundItems.length > 0) {
            console.log('Items without master cost (Sample):');
            console.table(notFoundItems.slice(0, 10));
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await poolEnd();
    }
}

backfillDec23();
