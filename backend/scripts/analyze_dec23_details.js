
const { query, poolEnd } = require('../config/database');

async function analyzeDec23() {
    try {
        console.log('🔍 ANALYZING DEC 23 MARGINS (Liquimon & Others)...');

        // Query for Liquimon and Others on Dec 23
        const sql = `
            SELECT 
                oi.id,
                oi.created_at,
                oi.product_code,
                oi.name,
                oi.quantity,
                oi.price,
                oi.purchase_cost,
                oi.profit_percent,
                p.product_name as master_name,
                p.purchasing_price as master_cost,
                CASE 
                    WHEN p.product_name LIKE '%LIQUIMON%' OR p.product_name LIKE '%BASE CITRICA%' THEN 'Liquimon'
                    ELSE 'Otros'
                END as detected_category
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE DATE(o.created_at) = '2025-12-23'
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND (
                p.product_name LIKE '%LIQUIMON%' 
                OR p.product_name LIKE '%BASE CITRICA%'
                OR oi.price > 0 -- Check all items to see 'Others'
            )
            AND oi.purchase_cost >= 0
            ORDER BY oi.profit_percent DESC
            LIMIT 50;
        `;

        const rows = await query(sql);

        console.log(`Found ${rows.length} items. Showing top high-margin items:`);

        // Filter for the suspicious categories mentioned by user or high margin
        const suspicious = rows.filter(r => r.profit_percent > 80);

        if (suspicious.length === 0) {
            console.log("No items with margin > 80% found via direct query. Checking summary...");
        } else {
            console.table(suspicious.map(r => ({
                id: r.id,
                code: r.product_code,
                name: r.name.substring(0, 20),
                qty: r.quantity,
                price: r.price,
                cost: r.purchase_cost,
                margin: r.profit_percent + '%',
                master_cost: r.master_cost
            })));
        }

        // Summary by Category Group for Dec 23
        const summarySql = `
            SELECT 
                CASE 
                    WHEN p.product_name LIKE '%LIQUIMON%' OR p.product_name LIKE '%BASE CITRICA%' THEN 'Liquimon'
                    ELSE 'Otros'
                END as category_group,
                COUNT(*) as count,
                AVG(oi.profit_percent) as avg_margin,
                SUM(oi.purchase_cost) as total_cost,
                SUM(oi.price * oi.quantity) as total_sales
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE DATE(o.created_at) = '2025-12-23'
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            GROUP BY category_group
        `;

        const summary = await query(summarySql);
        console.log('\nCategory Summary Dec 23:');
        console.table(summary);

    } catch (error) {
        console.error(error);
    } finally {
        await poolEnd();
    }
}

analyzeDec23();
