const { query } = require('../config/database');

async function checkSkarchamoyProducts() {
    try {
        console.log('🔍 Verificando productos SKARCHAMOY en la base de datos...\n');

        // Ver productos en la tabla products
        const productsTable = await query(`
            SELECT 
                id,
                product_name,
                internal_code,
                purchasing_price,
                standard_price,
                is_active
            FROM products
            WHERE product_name LIKE '%SKARCHAMOY%'
            ORDER BY product_name
        `);

        console.log('📦 Productos SKARCHAMOY en tabla PRODUCTS:\n');
        if (productsTable.length > 0) {
            productsTable.forEach(p => {
                const costStatus = p.purchasing_price > 0 ? '✅' : '❌';
                console.log(`   ${costStatus} ${p.product_name}`);
                console.log(`      Código: ${p.internal_code || 'N/A'} | Costo: $${p.purchasing_price} | Precio: $${p.standard_price} | Activo: ${p.is_active ? 'Sí' : 'No'}\n`);
            });
        } else {
            console.log('   ⚠️  No se encontraron productos SKARCHAMOY en la tabla products');
        }

        // Ver nombres usados en order_items
        const orderItemsNames = await query(`
            SELECT DISTINCT oi.name
            FROM order_items oi
            WHERE oi.name LIKE '%SKARCHAMOY%'
            ORDER BY oi.name
        `);

        console.log('\n📋 Nombres en ORDER_ITEMS (después de normalización):\n');
        orderItemsNames.forEach(item => {
            console.log(`   - ${item.name}`);
        });

        console.log('\n💡 ACCIÓN REQUERIDA:');
        console.log('   Para que las SALSAS SKARCHAMOY tengan costo en las métricas de rentabilidad,');
        console.log('   necesitas:');
        console.log('   1. Ir a la página de Inventario');
        console.log('   2. Buscar cada SALSA SKARCHAMOY');
        console.log('   3. Configurar su "Costo de Compra"');
        console.log('   4. O crear los productos si no existen en la tabla products');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkSkarchamoyProducts();
