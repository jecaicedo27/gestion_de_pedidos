
const { query, poolEnd } = require('../config/database');

function sanitizeText(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

async function fixDec20Sanitized() {
    try {
        console.log('Starting SANITIZED cost correction for Dec 20 orders...\n');

        // 1. Get items with cost 0 from Dec 20
        const itemsQuery = `
            SELECT 
                oi.id,
                oi.product_code,
                oi.name,
                oi.quantity,
                oi.price,
                oi.discount_percent,
                oi.purchase_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE DATE(o.created_at) = '2025-12-20'
            AND oi.purchase_cost = 0
        `;
        const items = await query(itemsQuery);
        console.log(`Found ${items.length} items with cost 0.`);

        // 2. Get all products from master
        const products = await query('SELECT internal_code, product_name, purchasing_price FROM products');

        // Build map both strict and sanitized
        const costMap = new Map();
        products.forEach(p => {
            const cost = parseFloat(p.purchasing_price);
            if (cost > 0) {
                if (p.internal_code) {
                    costMap.set(`CODE:${p.internal_code}`, cost);
                    costMap.set(`CODE:${sanitizeText(p.internal_code)}`, cost);
                }
                if (p.product_name) {
                    costMap.set(`NAME:${sanitizeText(p.product_name)}`, cost);
                }
            }
        });

        // 3. Match and Update
        let updated = 0;
        for (const item of items) {
            const rawCode = item.product_code;
            const productName = sanitizeText(item.name);

            const keyByCode = rawCode ? `CODE:${sanitizeText(rawCode)}` : null;
            const keyByName = `NAME:${productName}`;

            const masterCost = (keyByCode && costMap.has(keyByCode))
                ? costMap.get(keyByCode)
                : (costMap.get(keyByName) || 0);

            if (masterCost > 0) {
                const unitCost = masterCost;
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

                if (updated % 10 === 0) console.log(`Fixed item ${item.product_code}: cost ${unitCost}`);
                updated++;
            } else {
                console.log(`⚠️ Could not find master cost for: ${item.product_code} / ${item.name}`);
            }
        }

        console.log(`\n✅ Updated ${updated} items using sanitized matching.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

fixDec20Sanitized();
