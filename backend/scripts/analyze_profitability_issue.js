const { query, poolEnd } = require('../config/database');

async function analyzeProfitabilityIssue() {
    try {
        console.log('═══════════════════════════════════════════════════════');
        console.log(' PROFITABILITY ISSUE - COMPREHENSIVE ANALYSIS');
        console.log('═══════════════════════════════════════════════════════\n');

        // Part 1: Check for zero-cost items in Dec 24-25
        console.log('📊 Part 1: Zero-Cost Items Analysis (Dec 24-25)\n');
        console.log('─────────────────────────────────────────────────────');

        const zeroCostQuery = `
            SELECT 
                DATE(o.created_at) as date,
                COUNT(DISTINCT oi.id) as zero_cost_items,
                COUNT(DISTINCT o.id) as affected_orders
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= '2025-12-24 00:00:00'
            AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
            GROUP BY DATE(o.created_at)
            ORDER BY date
        `;

        const zeroCostStats = await query(zeroCostQuery);
        console.table(zeroCostStats);

        // Part 2: Sample problematic items with hex codes
        console.log('\n📋 Part 2: Sample Zero-Cost Items (with hex inspection)\n');
        console.log('─────────────────────────────────────────────────────');

        const sampleQuery = `
            SELECT 
                o.order_number,
                oi.product_code,
                HEX(oi.product_code) as code_hex,
                oi.name,
                oi.purchase_cost,
                p.internal_code as master_code,
                HEX(p.internal_code) as master_hex,
                p.purchasing_price as master_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE o.created_at >= '2025-12-24 00:00:00'
            AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
            LIMIT 10
        `;

        const samples = await query(sampleQuery);
        console.table(samples);

        // Part 3: Check for exact vs sanitized match success rate
        console.log('\n🔍 Part 3: Code Matching Analysis\n');
        console.log('─────────────────────────────────────────────────────');

        const matchAnalysis = `
            SELECT 
                'Exact Match' as match_type,
                COUNT(*) as count
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.internal_code = oi.product_code
            WHERE o.created_at >= '2025-12-24 00:00:00'
            AND oi.purchase_cost > 0
            
            UNION ALL
            
            SELECT 
                'Zero Cost (No Match)' as match_type,
                COUNT(*) as count
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= '2025-12-24 00:00:00'
            AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
            AND oi.product_code IS NOT NULL
        `;

        const matchStats = await query(matchAnalysis);
        console.table(matchStats);

        // Part 4: Check margin trends
        console.log('\n📈 Part 4: Daily Margin Trends (Dec 19-25)\n');
        console.log('─────────────────────────────────────────────────────');

        const marginQuery = `
            SELECT 
                DATE(o.created_at) as date,
                SUM(oi.profit_amount) as total_profit,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                ROUND((SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) * 100), 2) as margin_percent
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at >= '2025-12-19 00:00:00'
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.payment_method != 'reposicion'
            GROUP BY DATE(o.created_at)
            ORDER BY date
        `;

        const margins = await query(marginQuery);
        console.table(margins);

        // Part 5: Identify specific products always failing
        console.log('\n🎯 Part 5: Products Frequently Missing Cost\n');
        console.log('─────────────────────────────────────────────────────');

        const frequentFailures = `
            SELECT 
                oi.product_code,
                oi.name,
                COUNT(*) as times_imported_zero_cost,
                MAX(p.purchasing_price) as master_cost_available
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE o.created_at >= '2025-12-19 00:00:00'
            AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
            GROUP BY oi.product_code, oi.name
            HAVING COUNT(*) >= 3
            ORDER BY times_imported_zero_cost DESC
            LIMIT 20
        `;

        const frequent = await query(frequentFailures);
        console.table(frequent);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log(' END OF ANALYSIS');
        console.log('═══════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await poolEnd();
    }
}

analyzeProfitabilityIssue();
