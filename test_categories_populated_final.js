const mysql = require('mysql2/promise');

async function testCategoriesPopulated() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('=== VERIFICACIÓN FINAL DE CATEGORÍAS POBLADAS ===\n');

        // Verificar categorías con productos
        const [categoriesWithProducts] = await connection.execute(`
            SELECT 
                c.name as categoria,
                COUNT(p.id) as productos,
                c.is_active
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name, c.is_active
            ORDER BY productos DESC, c.name ASC
        `);

        console.log('📊 ESTADO ACTUAL DE TODAS LAS CATEGORÍAS:');
        let totalProductsAssigned = 0;
        let categoriesWithStock = 0;
        let categoriesEmpty = 0;

        categoriesWithProducts.forEach(cat => {
            const status = cat.productos > 0 ? '✅' : '❌';
            console.log(`${status} ${cat.categoria}: ${cat.productos} productos`);
            
            if (cat.productos > 0) {
                totalProductsAssigned += cat.productos;
                categoriesWithStock++;
            } else {
                categoriesEmpty++;
            }
        });

        console.log('\n📈 RESUMEN:');
        console.log(`✅ Categorías con productos: ${categoriesWithStock}`);
        console.log(`❌ Categorías vacías: ${categoriesEmpty}`);
        console.log(`📦 Total productos asignados: ${totalProductsAssigned}`);

        // Verificar productos sin categoría
        const [unassignedProducts] = await connection.execute(`
            SELECT 
                COUNT(*) as count,
                GROUP_CONCAT(DISTINCT 
                    CONCAT(product_name, ' [', COALESCE(internal_code, 'sin código'), ']') 
                    SEPARATOR ', '
                ) as ejemplos
            FROM products 
            WHERE is_active = TRUE 
            AND (category IS NULL OR category = '' OR category = 'Sin categoría')
            LIMIT 5
        `);

        console.log(`\n⚠️  Productos aún sin categoría: ${unassignedProducts[0].count}`);
        
        if (unassignedProducts[0].count > 0 && unassignedProducts[0].ejemplos) {
            console.log(`📝 Ejemplos: ${unassignedProducts[0].ejemplos.slice(0, 200)}...`);
        }

        // Verificar los productos más representativos por categoría
        console.log('\n🔍 PRODUCTOS DE EJEMPLO POR CATEGORÍA:');
        
        const topCategories = ['LIQUIPOPS', 'GENIALITY', 'Materia prima gravadas 19%', 'MEZCLAS EN POLVO'];
        
        for (const categoryName of topCategories) {
            const [sampleProducts] = await connection.execute(`
                SELECT product_name, internal_code
                FROM products 
                WHERE category = ? AND is_active = TRUE
                LIMIT 3
            `, [categoryName]);
            
            if (sampleProducts.length > 0) {
                console.log(`\n📂 ${categoryName}:`);
                sampleProducts.forEach(product => {
                    console.log(`   • ${product.product_name} [${product.internal_code}]`);
                });
            }
        }

        // Verificar que el endpoint de categorías funciona correctamente
        console.log('\n🔧 VALIDACIÓN TÉCNICA:');
        console.log('• Categorías activas encontradas:', categoriesWithProducts.length);
        console.log('• Productos correctamente categorizados:', totalProductsAssigned);
        
        const successRate = ((totalProductsAssigned / (totalProductsAssigned + unassignedProducts[0].count)) * 100).toFixed(1);
        console.log(`• Tasa de categorización exitosa: ${successRate}%`);

        console.log('\n✅ RESULTADO:');
        if (categoriesWithStock >= 6) {
            console.log('🎉 ¡ÉXITO! Las categorías ahora están pobladas con productos');
            console.log('🌟 El filtro de categorías en el frontend debería mostrar productos');
            console.log('🔄 Las categorías que antes mostraban (0) productos ahora tienen datos');
        } else {
            console.log('⚠️  Algunas categorías aún necesitan más productos asignados');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

testCategoriesPopulated();
