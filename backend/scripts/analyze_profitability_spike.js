
const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

const analyzeSpike = async () => {
    try {
        console.log('🔍 Analyzing profitability for 2025-12-19...');

        const date = '2025-12-19';
        const start = `${date} 00:00:00`;
        const end = `${date} 23:59:59`;

        const sql = `
            SELECT 
                o.id,
                o.order_number,
                o.created_at,
                oi.name as product_name,
                oi.quantity,
                oi.price,
                oi.purchase_cost,
                oi.profit_amount,
                (oi.quantity * oi.price) as total_sale,
                ((oi.profit_amount) / (oi.quantity * oi.price)) * 100 as margin_percent
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado')
            AND o.deleted_at IS NULL
            AND oi.price >= 100
            AND oi.name NOT LIKE '%Flete%'
            ORDER BY margin_percent DESC
            LIMIT 50;
        `;

        const results = await query(sql, [start, end]);

        console.log(`Found ${results.length} items.`);

        results.forEach(row => {
            console.log(`Order #${row.order_number} | Prod: ${row.product_name} | Price: ${row.price} | Cost: ${row.purchase_cost} | Profit: ${row.profit_amount} | Margin: ${Number(row.margin_percent).toFixed(2)}%`);
        });

        // Also check simplified group
        const groupSql = `
            SELECT 
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.profit_amount) as total_profit,
                (SUM(oi.profit_amount) / SUM(oi.quantity * oi.price)) * 100 as margin_percent
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado')
            AND o.deleted_at IS NULL
            AND oi.price >= 100
            AND oi.name NOT LIKE '%Flete%';
        `;

        const [groupResult] = await query(groupSql, [start, end]);
        console.log('\n--- Daily Aggregate ---');
        console.log(`Total Sales: ${groupResult.total_sales}`);
        console.log(`Total Profit: ${groupResult.total_profit}`);
        console.log(`Margin: ${Number(groupResult.margin_percent).toFixed(2)}%`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
};

analyzeSpike();
