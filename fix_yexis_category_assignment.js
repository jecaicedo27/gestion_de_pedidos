const mysql = require('mysql2/promise');

async function fixYexisCategoryAssignment() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('=== ASIGNANDO PRODUCTOS YEXIS A LA CATEGORÍA CORRECTA ===\n');

        // 1. Contar productos YEXIS sin categoría
        const [unassignedYexis] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM products 
            WHERE (
                product_name LIKE '%YEXIS%' OR 
                internal_code LIKE '%YEX%' OR
                internal_code LIKE '%YEXIS%'
            )
            AND is_active = TRUE
            AND (category IS NULL OR category = '' OR category = 'Sin categoría')
        `);

        console.log(`📊 Productos YEXIS sin categorizar: ${unassignedYexis[0].count}`);

        // 2. Asignar todos los productos YEXIS a la categoría YEXIS
        const [result] = await connection.execute(`
            UPDATE products 
            SET category = 'YEXIS'
            WHERE (
                product_name LIKE '%YEXIS%' OR 
                internal_code LIKE '%YEX%' OR
                internal_code LIKE '%YEXIS%'
            )
            AND is_active = TRUE
            AND (category IS NULL OR category = '' OR category = 'Sin categoría')
        `);

        console.log(`✅ ${result.affectedRows} productos YEXIS asignados a la categoría 'YEXIS'`);

        // 3. Verificar la asignación
        const [yexisProductsAfter] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM products 
            WHERE category = 'YEXIS' AND is_active = TRUE
        `);

        console.log(`📈 Productos en categoría YEXIS después de la asignación: ${yexisProductsAfter[0].count}`);

        // 4. Mostrar algunos ejemplos
        const [examples] = await connection.execute(`
            SELECT product_name, internal_code, category
            FROM products 
            WHERE category = 'YEXIS' AND is_active = TRUE
            LIMIT 5
        `);

        console.log('\n🔍 Ejemplos de productos asignados:');
        examples.forEach(product => {
            console.log(`• ${product.product_name} [${product.internal_code}] → ${product.category}`);
        });

        // 5. Verificar estado final de todas las categorías
        console.log('\n📊 ESTADO FINAL DE CATEGORÍAS:');
        const [finalStats] = await connection.execute(`
            SELECT 
                c.name as categoria,
                COUNT(p.id) as productos
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name
            ORDER BY productos DESC, c.name ASC
        `);

        let categoriesWithProducts = 0;
        finalStats.forEach(cat => {
            const status = cat.productos > 0 ? '✅' : '❌';
            console.log(`${status} ${cat.categoria}: ${cat.productos} productos`);
            if (cat.productos > 0) categoriesWithProducts++;
        });

        console.log(`\n🎉 Resumen: ${categoriesWithProducts} categorías ahora tienen productos`);

        if (yexisProductsAfter[0].count > 0) {
            console.log('✅ YEXIS category now has products!');
            console.log('🔄 The frontend should now display YEXIS with a product count');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

fixYexisCategoryAssignment();
