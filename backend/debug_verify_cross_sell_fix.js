const { query, poolEnd } = require('./config/database');

async function verifyFix() {
    try {
        const startQueryDate = '2025-12-01';
        const endQueryDate = '2025-12-31 23:59:59';

        console.log("Running Updated Cross-Sell Query...");

        const crossSellQuery = `
            SELECT 
                c.name,
                c.phone,
                SUM(oi.quantity * oi.price) as total_spent_period
            FROM orders o
            JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado')
            AND c.identification NOT IN (
                SELECT DISTINCT o2.customer_identification
                FROM orders o2
                JOIN order_items oi2 ON o2.id = oi2.order_id
                WHERE (
                    oi2.name LIKE '%PERLA%' 
                    OR oi2.name LIKE '%EXPLOSIVA%' 
                    OR oi2.name LIKE '%LIQUIPOPS%' 
                    OR oi2.name LIKE '%LIQUIPOS%'
                )
                AND o2.status NOT IN ('cancelado', 'anulado')
            )
            GROUP BY c.identification
            HAVING total_spent_period > 1000000
            ORDER BY total_spent_period DESC
            LIMIT 10
        `;

        const results = await query(crossSellQuery, [startQueryDate, endQueryDate]);

        console.log(`\nFound ${results.length} candidates.`);

        const juan = results.find(r => r.name.includes('Juan Carlos Ortiz'));

        if (juan) {
            console.log("❌ FAILED: Juan Carlos Ortiz Mantilla is STILL in the list.");
        } else {
            console.log("✅ SUCCESS: Juan Carlos Ortiz Mantilla is NOT in the list.");
        }

        console.log("\nCurrent List:");
        results.forEach(r => console.log(`- ${r.name} ($${r.total_spent_period.toLocaleString()})`));

    } catch (e) {
        console.error(e);
    } finally {
        await poolEnd();
    }
}

verifyFix();
