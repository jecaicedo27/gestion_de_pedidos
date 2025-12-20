const { query } = require('../config/database');

async function testAdvancedStatsStructure() {
    try {
        console.log('🔍 Probando estructura de respuesta de getAdvancedStats...\n');

        // Simular la misma query que usa el backend
        const profitByCustomerQuery = `
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
            GROUP BY c.identification, c.name
            ORDER BY total_profit DESC
            LIMIT 10
        `;

        const profitByCustomerResult = await query(profitByCustomerQuery);

        console.log('📊 Estructura de datos:');
        console.log('   Tipo:', typeof profitByCustomerResult);
        console.log('   Es Array?:', Array.isArray(profitByCustomerResult));
        console.log('   Longitud:', profitByCustomerResult.length);

        if (profitByCustomerResult.length > 0) {
            console.log('\n📦 Primer elemento:');
            console.log(JSON.stringify(profitByCustomerResult[0], null, 2));
        }

        // Simular respuesta del backend
        const mockResponse = {
            success: true,
            data: {
                profitByCustomer: profitByCustomerResult,
                profitByProduct: [],
                profitByCity: []
            }
        };

        console.log('\n✅ Estructura de respuesta simulada:');
        console.log(JSON.stringify(mockResponse, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testAdvancedStatsStructure();
