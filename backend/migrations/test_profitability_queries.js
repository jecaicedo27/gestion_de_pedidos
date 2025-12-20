const { query } = require('../config/database');

async function testProfitabilityQueries() {
    try {
        console.log('🔍 Probando queries de rentabilidad...\n');

        // Test 1: Profit by Customer
        console.log('1️⃣ PROBANDO: Top Rentabilidad por Cliente...\n');
        const profitByCustomer = await query(`
            SELECT 
                c.name,
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) as total_profit,
                (SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) / SUM(oi.quantity * oi.price)) * 100 as margin_percent
            FROM orders o
            JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            AND o.deleted_at IS NULL
            GROUP BY c.identification, c.name
            ORDER BY total_profit DESC
            LIMIT 10
        `);

        console.log(`   Resultados: ${profitByCustomer.length} clientes`);
        if (profitByCustomer.length > 0) {
            profitByCustomer.forEach((c, idx) => {
                const margin = c.margin_percent ? Number(c.margin_percent).toFixed(2) : '0.00';
                console.log(`   ${idx + 1}. ${c.name}: $${Number(c.total_profit).toLocaleString()} (${margin}%)`);
            });
        } else {
            console.log('   ⚠️  Sin resultados');
        }

        // Test 2: Profit by Product  
        console.log('\n2️⃣ PROBANDO: Top Rentabilidad por Producto...\n');
        const profitByProduct = await query(`
            SELECT 
                p.product_name,
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) as total_profit,
                (SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) / SUM(oi.quantity * oi.price)) * 100 as margin_percent
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            AND o.deleted_at IS NULL
            GROUP BY p.id, p.product_name
            ORDER BY total_profit DESC
            LIMIT 10
        `);

        console.log(`   Resultados: ${profitByProduct.length} productos`);
        if (profitByProduct.length > 0) {
            profitByProduct.forEach((p, idx) => {
                const margin = p.margin_percent ? Number(p.margin_percent).toFixed(2) : '0.00';
                console.log(`   ${idx + 1}. ${p.product_name || 'Sin nombre'}: $${Number(p.total_profit).toLocaleString()} (${margin}%)`);
            });
        } else {
            console.log('   ⚠️  Sin resultados');
        }

        // Test 3: Profit by City
        console.log('\n3️⃣ PROBANDO: Rentabilidad por Ciudad...\n');
        const profitByCity = await query(`
            SELECT 
                COALESCE(o.shipping_city, c.city, 'Desconocido') as city,
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) as total_profit,
                (SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) / SUM(oi.quantity * oi.price)) * 100 as margin_percent
            FROM orders o
            LEFT JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            AND o.deleted_at IS NULL
            GROUP BY city
            ORDER BY total_profit DESC
            LIMIT 5
        `);

        console.log(`   Resultados: ${profitByCity.length} ciudades`);
        if (profitByCity.length > 0) {
            profitByCity.forEach((c, idx) => {
                const margin = c.margin_percent ? Number(c.margin_percent).toFixed(2) : '0.00';
                console.log(`   ${idx + 1}. ${c.city}: $${Number(c.total_profit).toLocaleString()} (${margin}%)`);
            });
        } else {
            console.log('   ⚠️  Sin resultados');
        }

        // Check if orders exist in the period
        console.log('\n📊 VERIFICACIÓN DE DATOS BASE:\n');
        const [orderCount] = await query(`
            SELECT 
                COUNT(*) as total_orders,
                COUNT(DISTINCT customer_identification) as unique_customers
            FROM orders
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND status NOT IN ('cancelado', 'anulado')
            AND deleted_at IS NULL
        `);

        console.log(`   Órdenes (30 días): ${orderCount.total_orders}`);
        console.log(`   Clientes únicos: ${orderCount.unique_customers}`);

        console.log('\n✅ Test completado!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testProfitabilityQueries();
