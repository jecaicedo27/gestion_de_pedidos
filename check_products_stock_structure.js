const { query } = require('./backend/config/database');

async function checkProductsStockStructure() {
    console.log('📊 VERIFICANDO ESTRUCTURA DE STOCK EN PRODUCTOS');
    console.log('===============================================');

    try {
        // 1. Verificar estructura de la tabla products
        console.log('1️⃣ Consultando estructura de la tabla products...');
        
        const tableStructure = await query('DESCRIBE products');
        
        console.log('📋 COLUMNAS ACTUALES EN LA TABLA PRODUCTS:');
        tableStructure.forEach((column, index) => {
            console.log(`   ${index + 1}. ${column.Field} (${column.Type}) - ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        // Verificar si existe columna de stock
        const hasStockColumn = tableStructure.some(col => 
            col.Field.includes('stock') || 
            col.Field.includes('inventory') || 
            col.Field.includes('available') ||
            col.Field.includes('quantity')
        );

        console.log(`\n📦 ¿Tiene columna de stock? ${hasStockColumn ? '✅ SÍ' : '❌ NO'}`);

        // 2. Verificar algunos productos de muestra
        console.log('\n2️⃣ Consultando productos de muestra...');
        
        const sampleProducts = await query(`
            SELECT id, product_name, barcode, category, standard_price, created_at
            FROM products 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        console.log('📋 MUESTRA DE PRODUCTOS:');
        sampleProducts.forEach((product, index) => {
            console.log(`   ${index + 1}. ${product.product_name}`);
            console.log(`      ID: ${product.id}`);
            console.log(`      Código: ${product.barcode}`);
            console.log(`      Categoría: ${product.category}`);
            console.log(`      Precio: $${product.standard_price}`);
            console.log('');
        });

        // 3. Contar total de productos
        const totalProducts = await query('SELECT COUNT(*) as total FROM products');
        console.log(`📊 Total productos en base de datos: ${totalProducts[0].total}`);

        // 4. Verificar si hay alguna tabla de inventario separada
        console.log('\n3️⃣ Verificando si existe tabla de inventario...');
        
        try {
            const inventoryTables = await query(`
                SHOW TABLES LIKE '%inventory%' 
                UNION 
                SHOW TABLES LIKE '%stock%'
                UNION
                SHOW TABLES LIKE '%product_stock%'
            `);
            
            if (inventoryTables.length > 0) {
                console.log('📋 TABLAS DE INVENTARIO ENCONTRADAS:');
                inventoryTables.forEach((table, index) => {
                    const tableName = Object.values(table)[0];
                    console.log(`   ${index + 1}. ${tableName}`);
                });
            } else {
                console.log('❌ No se encontraron tablas específicas de inventario');
            }
        } catch (error) {
            console.log('❌ Error consultando tablas de inventario:', error.message);
        }

        // 5. Recomendaciones
        console.log('\n🎯 RECOMENDACIONES:');
        console.log('===================');
        
        if (!hasStockColumn) {
            console.log('❗ ACCIÓN NECESARIA: Agregar columna de stock a la tabla products');
            console.log('   Opciones:');
            console.log('   - stock (INT) - Cantidad disponible');
            console.log('   - available_stock (INT) - Stock disponible');
            console.log('   - inventory_quantity (INT) - Cantidad en inventario');
        } else {
            console.log('✅ La tabla ya tiene información de stock');
        }

        console.log('\n📝 PRÓXIMOS PASOS:');
        console.log('1. Agregar columna de stock si no existe');
        console.log('2. Actualizar el servicio de importación para incluir stock');
        console.log('3. Modificar el controlador para devolver stock en la API');
        console.log('4. Actualizar el frontend para mostrar stock');

    } catch (error) {
        console.error('❌ Error verificando estructura:', error.message);
    }
}

// Ejecutar verificación
checkProductsStockStructure().then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
