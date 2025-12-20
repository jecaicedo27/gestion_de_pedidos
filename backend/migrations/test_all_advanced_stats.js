const { query } = require('../config/database');

async function testAllAdvancedStats() {
    try {
        console.log('🔍 Probando TODAS las queries de advancedStats...\n');

        // 1. Churn Risk
        const churnQuery = `
            SELECT 
                c.name,
                c.identification,
                MAX(o.created_at) as last_order_date,
                DATEDIFF(NOW(), MAX(o.created_at)) as days_since_last_order,
                COUNT(o.id) as total_orders
            FROM customers c
            LEFT JOIN orders o ON c.identification = o.customer_identification
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            AND o.status NOT IN ('cancelado', 'anulado')
            GROUP BY c.identification, c.name
            HAVING days_since_last_order > 30
            ORDER BY days_since_last_order DESC
            LIMIT 10
        `;

        const churnResult = await query(churnQuery);
        console.log('1️⃣ RIESGO DE FUGA:');
        console.log(`   Resultados: ${churnResult.length}`);
        if (churnResult.length > 0) {
            console.log(`   Ejemplo: ${churnResult[0].name} - ${churnResult[0].days_since_last_order} días sin comprar`);
        }

        // 2. Cross-Sell
        const crossSellQuery = `
            SELECT 
                c.name,
                COUNT(DISTINCT oi.name) as unique_products
            FROM customers c
            JOIN orders o ON c.identification = o.customer_identification
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            GROUP BY c.identification, c.name
            HAVING unique_products < 5
            ORDER BY unique_products ASC
            LIMIT 10
        `;

        const crossSellResult = await query(crossSellQuery);
        console.log('\n2️⃣ OPORTUNIDAD CROSS-SELL:');
        console.log(`   Resultados: ${crossSellResult.length}`);
        if (crossSellResult.length > 0) {
            console.log(`   Ejemplo: ${crossSellResult[0].name} - ${crossSellResult[0].unique_products} productos únicos`);
        }

        // 3. Top Cities
        const citiesQuery = `
            SELECT 
                COALESCE(o.shipping_city, c.city, 'Desconocido') as city,
                COUNT(o.id) as order_count,
                SUM(oi.quantity * oi.price) as total_sales
            FROM orders o
            LEFT JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            GROUP BY city
            ORDER BY total_sales DESC
            LIMIT 5
        `;

        const citiesResult = await query(citiesQuery);
        console.log('\n3️⃣ TOP CIUDADES:');
        console.log(`   Resultados: ${citiesResult.length}`);
        if (citiesResult.length > 0) {
            console.log(`   Ejemplo: ${citiesResult[0].city} - ${citiesResult[0].order_count} pedidos`);
        }

        console.log('\n✅ Test completado!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testAllAdvancedStats();
