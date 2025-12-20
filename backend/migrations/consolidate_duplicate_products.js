const { query } = require('../config/database');

/**
 * Script para consolidar productos duplicados en order_items
 * Productos con nombres similares pero códigos diferentes se unifican
 */

async function consolidateDuplicateProducts() {
    try {
        console.log('🔍 Buscando productos duplicados...\n');

        // 1. Detectar productos similares en order_items
        const duplicates = await query(`
            SELECT 
                oi.name,
                COUNT(DISTINCT o.id) as order_count,
                SUM(oi.quantity) as total_quantity
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.name LIKE '%SKARCHAMOY%'
            OR oi.name LIKE '%SIROPE%'
            OR oi.name LIKE '%SALSA%'
            GROUP BY oi.name
            ORDER BY oi.name
        `);

        console.log('📋 Productos encontrados con variaciones:\n');
        duplicates.forEach(d => {
            console.log(`   ${d.name}`);
            console.log(`      Órdenes: ${d.order_count} | Cantidad vendida: ${d.total_quantity}\n`);
        });

        // 2. Definir mapeos de consolidación
        const consolidationMap = {
            // SIROPE SKARCHAMOY
            'SIROPE SKARCHAMOY DE 500Ml': [
                'SIROPE SKARCHAMOY DE 500ML',
                'SIROPE SKARCHAMOY DE 500Ml',
                'SIROPE SKARCHAMOY 500ML'
            ],
            'SIROPE SKARCHAMOY DE 1000ML': [
                'SIROPE SKARCHAMOY DE 1000Ml',
                'SIROPE SKARCHAMOY DE 1000ML',
                'SIROPE SKARCHAMOY 1000ML',
                'SIROPE SKARCHAMOY DE 1000ml'
            ],
            'SIROPE SKARCHAMOY DE 250ML': [
                'SIROPE SKARCHAMOY DE 250Ml',
                'SIROPE SKARCHAMOY DE 250ML',
                'SIROPE SKARCHAMOY 250ML'
            ],
            // SALSA SKARCHAMOY
            'SALSA SKARCHAMOY DE 500ML': [
                'SALSA SKARCHAMOY DE 500Ml',
                'SALSA SKARCHAMOY DE 500ML',
                'SALSA SKARCHAMOY 500ML'
            ],
            'SALSA SKARCHAMOY DE 1000ML': [
                'SALSA SKARCHAMOY DE 1000Ml',
                'SALSA SKARCHAMOY DE 1000ML',
                'SALSA SKARCHAMOY 1000ML'
            ],
            'SALSA SKARCHAMOY DE 250ML': [
                'SALSA SKARCHAMOY DE 250Ml',
                'SALSA SKARCHAMOY DE 250ML',
                'SALSA SKARCHAMOY 250ML'
            ]
        };

        console.log('\n🔄 Iniciando consolidación...\n');

        let totalUpdated = 0;

        for (const [targetName, variants] of Object.entries(consolidationMap)) {
            console.log(`📌 Consolidando a: "${targetName}"`);

            for (const variantName of variants) {
                const result = await query(`
                    UPDATE order_items
                    SET name = ?
                    WHERE name = ?
                `, [targetName, variantName]);

                if (result.affectedRows > 0) {
                    console.log(`   ✅ "${variantName}" → ${result.affectedRows} items actualizados`);
                    totalUpdated += result.affectedRows;
                } else {
                    console.log(`   ⏭️  "${variantName}" → sin cambios`);
                }
            }
            console.log('');
        }

        console.log(`\n✅ Total de items consolidados: ${totalUpdated}`);

        // 3. Verificar resultado
        const afterConsolidation = await query(`
            SELECT 
                oi.name,
                COUNT(DISTINCT o.id) as order_count,
                SUM(oi.quantity) as total_quantity
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.name LIKE '%SKARCHAMOY%'
            GROUP BY oi.name
            ORDER BY oi.name
        `);

        console.log('\n📊 RESULTADO FINAL (productos únicos):\n');
        afterConsolidation.forEach(d => {
            console.log(`   ${d.name}`);
            console.log(`      Órdenes: ${d.order_count} | Cantidad vendida: ${d.total_quantity}\n`);
        });

        console.log('✅ Consolidación completada!');
        console.log('💡 Ahora las métricas de rentabilidad mostrarán estos productos agrupados correctamente.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

consolidateDuplicateProducts();
