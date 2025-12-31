
const { query, poolEnd } = require('../config/database');

async function analyzeDec24Otros() {
    try {
        console.log('🔍 ANALYZING DEC 24 "OTROS" CATEGORY MARGINS...');

        const sql = `
            SELECT 
                oi.id,
                oi.product_code,
                oi.name,
                oi.quantity,
                oi.price,
                oi.purchase_cost,
                oi.profit_percent,
                p.product_name as master_name,
                CASE 
                    WHEN p.product_name LIKE '%GENIALITY%' OR p.product_name LIKE '%SIROPE GENIALITY%' THEN 'Geniality'
                    WHEN p.product_name LIKE '%SKARCHA%' OR p.product_name LIKE '%ESCARCHA%' OR p.product_name LIKE '%SKARCHAMOY%' THEN 'Skarcha'
                    WHEN p.product_name LIKE '%LIQUIPOPS%' THEN 'Liquipops'
                    WHEN p.product_name LIKE '%YEXIS%' THEN 'Yexis'
                    WHEN p.product_name LIKE '%LIQUIMON%' OR p.product_name LIKE '%BASE CITRICA%' THEN 'Liquimon'
                    WHEN p.product_name LIKE '%BANDERITA%' OR p.product_name LIKE '%FRUTOS SECOS%' THEN 'Banderitas + Frutos Secos'
                    WHEN p.product_name LIKE '%PULPA%' THEN 'Pulpas de Fruta'
                    ELSE 'Otros'
                END as category_group
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE DATE(o.created_at) = '2025-12-24'
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.payment_method != 'reposicion'
            AND oi.product_code NOT IN ('FL01', 'PROPINA')
            HAVING category_group = 'Otros'
            ORDER BY oi.profit_percent DESC;
        `;

        const rows = await query(sql);

        console.log(`Found ${rows.length} items in "Otros". Showing top 20 high-margin items:`);

        console.table(rows.slice(0, 20).map(r => ({
            name: r.name.substring(0, 30),
            qty: r.quantity,
            price: r.price,
            cost: r.purchase_cost,
            margin: Number(r.profit_percent).toFixed(1) + '%'
        })));

        // Calculate weighted stats
        const totalSales = rows.reduce((sum, r) => sum + (r.price * r.quantity), 0);
        const totalCost = rows.reduce((sum, r) => sum + (r.purchase_cost * r.quantity), 0); // Assuming purchase_cost is unit cost
        const overallMargin = totalSales > 0 ? ((totalSales - totalCost) / totalSales) * 100 : 0;

        console.log('\n📊 Summary for "Otros" on Dec 24:');
        console.log(`Total Sales: $${totalSales.toLocaleString()}`);
        console.log(`Total Cost: $${totalCost.toLocaleString()}`); // purchase_cost in DB is usually unit cost, so multiplying by qty is correct if consistent with other scripts
        // Wait, check standard usage. In siigoService.js:
        // await query('UPDATE order_items SET ... purchase_cost = ? ...', [unitCost...]);
        // So purchase_cost is UNIT cost.
        // Wait, let's verify if totalProfit usage implies otherwise. 
        // adminController.js says: total_profit += Number(curr.total_profit);
        // And `profit_amount` column exists.
        // Let's use profit_amount if available? My query selected purchase_cost.
        // Let's stick to unit calculation for verifying.

        console.log(`Calculated Margin: ${overallMargin.toFixed(1)}%`);

    } catch (error) {
        console.error(error);
    } finally {
        await poolEnd();
    }
}

analyzeDec24Otros();
