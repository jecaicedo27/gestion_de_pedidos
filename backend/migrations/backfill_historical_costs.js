const { query } = require('../config/database');

/**
 * Script para rellenar purchase_cost en order_items históricos
 * usando los costos reales de purchasing_price de products
 */
async function backfillHistoricalCosts() {
    try {
        console.log('🔄 Iniciando backfill de costos históricos...');

        // 1. Contar cuántos items necesitan actualización
        const [countResult] = await query(`
            SELECT COUNT(*) as total
            FROM order_items oi
            WHERE oi.purchase_cost IS NULL
        `);

        const totalToUpdate = countResult.total;
        console.log(`📊 Total de items a actualizar: ${totalToUpdate}`);

        if (totalToUpdate === 0) {
            console.log('✅ No hay items para actualizar. Todos tienen purchase_cost.');
            process.exit(0);
        }

        // 2. Actualizar purchase_cost con el purchasing_price actual de products
        console.log('💰 Actualizando purchase_cost desde products.purchasing_price...');

        const updateResult = await query(`
            UPDATE order_items oi
            JOIN products p ON p.product_name = oi.name
            SET oi.purchase_cost = p.purchasing_price
            WHERE oi.purchase_cost IS NULL
            AND p.purchasing_price > 0
        `);

        console.log(`✅ Actualizados ${updateResult.affectedRows} items con costos reales`);

        // 3. Verificar cuántos quedaron sin costo (productos sin purchasing_price)
        const [remainingResult] = await query(`
            SELECT COUNT(*) as remaining
            FROM order_items oi
            WHERE oi.purchase_cost IS NULL
        `);

        const remainingNull = remainingResult.remaining;

        if (remainingNull > 0) {
            console.log(`⚠️  ${remainingNull} items siguen sin costo (productos sin purchasing_price configurado)`);

            // Mostrar algunos ejemplos
            const examples = await query(`
                SELECT DISTINCT oi.name, COUNT(*) as count
                FROM order_items oi
                LEFT JOIN products p ON p.product_name = oi.name
                WHERE oi.purchase_cost IS NULL
                GROUP BY oi.name
                ORDER BY count DESC
                LIMIT 10
            `);

            console.log('\n📋 Productos sin costo (top 10):');
            examples.forEach(ex => {
                console.log(`   - ${ex.name}: ${ex.count} items`);
            });

            console.log('\n💡 Estos productos necesitan que configures su purchasing_price en el inventario.');
        }

        // 4. Mostrar resumen final
        const [summary] = await query(`
            SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN purchase_cost IS NOT NULL THEN 1 ELSE 0 END) as with_cost,
                SUM(CASE WHEN purchase_cost IS NULL THEN 1 ELSE 0 END) as without_cost,
                ROUND(SUM(CASE WHEN purchase_cost IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as percentage_complete
            FROM order_items
        `);

        console.log('\n📊 RESUMEN FINAL:');
        console.log(`   Total items: ${summary.total_items}`);
        console.log(`   Con costo: ${summary.with_cost} (${summary.percentage_complete}%)`);
        console.log(`   Sin costo: ${summary.without_cost}`);
        console.log('\n✅ Backfill completado!');
        console.log('💡 Ahora las consultas de rentabilidad usarán costos reales en lugar del fallback 65%');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error en backfill:', error);
        process.exit(1);
    }
}

backfillHistoricalCosts();
