const { query } = require('../config/database');

/**
 * Script para normalizar COMPLETAMENTE los nombres de productos SKARCHAMOY
 */

async function normalizeSkarchamoyProducts() {
    try {
        console.log('🔄 Normalizando productos SKARCHAMOY...\n');

        // Normalizar todos los SIROPE SKARCHAMOY a formato estándar
        const normalizationRules = [
            // 500ML
            {
                standard: 'SIROPE SKARCHAMOY DE 500 ML',
                variants: [
                    'SIROPE SKARCHAMOY DE 500ML',
                    'SIROPE SKARCHAMOY DE 500Ml',
                    'SIROPE SKARCHAMOY DE 500 ml',
                    'SIROPE SKARCHAMOY 500ML',
                    'SIROPE SKARCHAMOY 500 ML'
                ]
            },
            // 1000ML
            {
                standard: 'SIROPE SKARCHAMOY DE 1000 ML',
                variants: [
                    'SIROPE SKARCHAMOY DE 1000ML',
                    'SIROPE SKARCHAMOY DE 1000Ml',
                    'SIROPE SKARCHAMOY DE 1000 ml',
                    'SIROPE SKARCHAMOY 1000ML',
                    'SIROPE SKARCHAMOY 1000 ML'
                ]
            },
            // 250ML
            {
                standard: 'SIROPE SKARCHAMOY DE 250 ML',
                variants: [
                    'SIROPE SKARCHAMOY DE 250ML',
                    'SIROPE SKARCHAMOY DE 250Ml',
                    'SIROPE SKARCHAMOY DE 250 ml',
                    'SIROPE SKARCHAMOY 250ML',
                    'SIROPE SKARCHAMOY 250 ML'
                ]
            },
            // SALSA 500ML
            {
                standard: 'SALSA SKARCHAMOY DE 500 ML',
                variants: [
                    'SALSA SKARCHAMOY DE 500ML',
                    'SALSA SKARCHAMOY DE 500Ml',
                    'SALSA SKARCHAMOY DE 500 ml',
                    'SALSA SKARCHAMOY 500ML',
                    'SALSA SKARCHAMOY 500 ML'
                ]
            },
            // SALSA 1000ML
            {
                standard: 'SALSA SKARCHAMOY DE 1000 ML',
                variants: [
                    'SALSA SKARCHAMOY DE 1000ML',
                    'SALSA SKARCHAMOY DE 1000Ml',
                    'SALSA SKARCHAMOY DE 1000 ml',
                    'SALSA SKARCHAMOY 1000ML',
                    'SALSA SKARCHAMOY 1000 ML'
                ]
            },
            // SALSA 250ML
            {
                standard: 'SALSA SKARCHAMOY DE 250 ML',
                variants: [
                    'SALSA SKARCHAMOY DE 250ML',
                    'SALSA SKARCHAMOY DE 250Ml',
                    'SALSA SKARCHAMOY DE 250 ml',
                    'SALSA SKARCHAMOY 250ML',
                    'SALSA SKARCHAMOY 250 ML'
                ]
            }
        ];

        let totalUpdated = 0;

        for (const rule of normalizationRules) {
            console.log(`📌 Normalizando a: "${rule.standard}"`);

            for (const variant of rule.variants) {
                const result = await query(`
                    UPDATE order_items
                    SET name = ?
                    WHERE name = ?
                `, [rule.standard, variant]);

                if (result.affectedRows > 0) {
                    console.log(`   ✅ "${variant}" → ${result.affectedRows} items`);
                    totalUpdated += result.affectedRows;
                }
            }
        }

        console.log(`\n✅ Total normalizado: ${totalUpdated} items\n`);

        // Verificar resultado final
        const finalProducts = await query(`
            SELECT 
                oi.name,
                COUNT(DISTINCT o.id) as order_count,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.quantity * oi.price) as total_sales
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.name LIKE '%SKARCHAMOY%'
            GROUP BY oi.name
            ORDER BY total_sales DESC
        `);

        console.log('📊 PRODUCTOS FINALES (SKARCHAMOY):\n');
        finalProducts.forEach(p => {
            console.log(`   ${p.name}`);
            console.log(`      Órdenes: ${p.order_count} | Cantidad: ${p.total_quantity} | Ventas: $${p.total_sales.toLocaleString()}\n`);
        });

        console.log('✅ Normalización completada!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

normalizeSkarchamoyProducts();
