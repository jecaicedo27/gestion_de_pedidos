const { query } = require('../config/database');

async function investigateNullProducts() {
    try {
        console.log('🔍 Investigando productos sin nombre...\n');

        // 1. Buscar order_items que generan productos NULL
        const itemsWithNullProduct = await query(`
            SELECT 
                oi.id,
                oi.order_id,
                oi.name as item_name,
                oi.quantity,
                oi.price,
                p.product_name,
                p.internal_code,
                p.id as product_id,
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.quantity * (oi.price - COALESCE(oi.purchase_cost, NULLIF(p.purchasing_price, 0), COALESCE(p.standard_price, oi.price) * 0.65))) as total_profit
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            AND (p.product_name IS NULL OR p.product_name = '')
            GROUP BY oi.name
            ORDER BY total_sales DESC
            LIMIT 10
        `);

        console.log(`📦 Items en pedidos sin producto asociado: ${itemsWithNullProduct.length}\n`);

        if (itemsWithNullProduct.length > 0) {
            console.log('📋 DETALLE:\n');
            itemsWithNullProduct.forEach((item, idx) => {
                console.log(`${idx + 1}. Nombre en order_item: "${item.item_name || 'NULL'}"`);
                console.log(`   Ventas: $${Number(item.total_sales).toLocaleString()}`);
                console.log(`   Ganancia: $${Number(item.total_profit).toLocaleString()}`);
                console.log(`   Producto asociado: ${item.product_name || 'NO ENCONTRADO'}`);
                console.log('');
            });
        }

        // 2. Buscar nombres únicos en order_items que no coinciden con products
        const unmatchedNames = await query(`
            SELECT DISTINCT
                oi.name as order_item_name,
                COUNT(DISTINCT o.id) as order_count,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.quantity * oi.price) as total_sales
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            AND p.id IS NULL
            GROUP BY oi.name
            ORDER BY total_sales DESC
        `);

        console.log(`\n🔎 Nombres en order_items sin coincidencia en products: ${unmatchedNames.length}\n`);
        if (unmatchedNames.length > 0) {
            unmatchedNames.forEach((item, idx) => {
                console.log(`${idx + 1}. "${item.order_item_name || 'NULL'}"`);
                console.log(`   Pedidos: ${item.order_count} | Cantidad: ${item.total_quantity} | Ventas: $${Number(item.total_sales).toLocaleString()}`);
            });
        }

        console.log('\n✅ Investigación completada!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

investigateNullProducts();
