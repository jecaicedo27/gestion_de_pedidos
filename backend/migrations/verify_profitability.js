const { query } = require('../config/database');

async function verifyProfitabilityCalculations() {
    try {
        console.log('🔍 Verificando cálculos de rentabilidad...\n');

        // 1. Verificar cobertura de costos
        const [coverage] = await query(`
            SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN purchase_cost IS NOT NULL AND purchase_cost > 0 THEN 1 ELSE 0 END) as with_real_cost,
                SUM(CASE WHEN purchase_cost IS NULL OR purchase_cost = 0 THEN 1 ELSE 0 END) as with_fallback,
                ROUND(SUM(CASE WHEN purchase_cost IS NOT NULL AND purchase_cost > 0 THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as percentage_real
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
        `);

        console.log('📊 COBERTURA DE COSTOS (Últimos 30 días):');
        console.log(`   Total items vendidos: ${coverage.total_items}`);
        console.log(`   Con costo real: ${coverage.with_real_cost} (${coverage.percentage_real}%)`);
        console.log(`   Sin costo (usarán fallback): ${coverage.with_fallback}`);

        // 2. Comparar rentabilidad con método antiguo vs nuevo
        const [comparison] = await query(`
            SELECT 
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.quantity * COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65)) as total_cost_new,
                SUM(oi.quantity * (COALESCE(p.standard_price, oi.price) * 0.65)) as total_cost_old,
                SUM(oi.quantity * oi.price) - SUM(oi.quantity * COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65)) as profit_new,
                SUM(oi.quantity * oi.price) - SUM(oi.quantity * (COALESCE(p.standard_price, oi.price) * 0.65)) as profit_old
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
        `);

        const marginNew = ((comparison.profit_new / comparison.total_sales) * 100).toFixed(2);
        const marginOld = ((comparison.profit_old / comparison.total_sales) * 100).toFixed(2);
        const difference = (comparison.profit_new - comparison.profit_old).toFixed(2);

        console.log('\n💰 COMPARACIÓN DE RENTABILIDAD (Últimos 30 días):');
        console.log(`   Ventas Totales: $${comparison.total_sales.toLocaleString()}`);
        console.log('\n   MÉTODO ANTIGUO (65% costo estimado):');
        console.log(`     Costo: $${comparison.total_cost_old.toLocaleString()}`);
        console.log(`     Ganancia: $${comparison.profit_old.toLocaleString()}`);
        console.log(`     Margen: ${marginOld}%`);
        console.log('\n   MÉTODO NUEVO (costos reales):');
        console.log(`     Costo: $${comparison.total_cost_new.toLocaleString()}`);
        console.log(`     Ganancia: $${comparison.profit_new.toLocaleString()}`);
        console.log(`     Margen: ${marginNew}%`);
        console.log(`\n   📈 Diferencia: $${difference.toLocaleString()} ${difference > 0 ? '(más ganancia real)' : '(menos ganancia real)'}`);

        // 3. Top 5 productos más rentables (con costos reales)
        const topProducts = await query(`
            SELECT 
                p.product_name,
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.quantity * COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65)) as total_cost,
                SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) as total_profit,
                ROUND((SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) / SUM(oi.quantity * oi.price)) * 100, 2) as margin_percent
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            GROUP BY p.id, p.product_name
            ORDER BY total_profit DESC
            LIMIT 5
        `);

        console.log('\n🏆 TOP 5 PRODUCTOS MÁS RENTABLES (con costos reales):');
        topProducts.forEach((prod, idx) => {
            console.log(`   ${idx + 1}. ${prod.product_name}`);
            console.log(`      Ventas: $${prod.total_sales.toLocaleString()} | Ganancia: $${prod.total_profit.toLocaleString()} | Margen: ${prod.margin_percent}%`);
        });

        console.log('\n✅ Verificación completada!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifyProfitabilityCalculations();
