const { pool } = require('./backend/config/database');

async function addMissingStockColumn() {
    console.log('🔧 Adding Missing Stock Column to Products Table');
    console.log('=' .repeat(60));
    
    try {
        // Paso 1: Verificar si la columna stock ya existe
        console.log('\n📊 PASO 1: Verificando estructura actual');
        const [columns] = await pool.execute('DESCRIBE products');
        
        const hasStockColumn = columns.some(col => col.Field === 'stock');
        const hasAvailableQuantity = columns.some(col => col.Field === 'available_quantity');
        
        console.log(`   available_quantity: ${hasAvailableQuantity ? '✅ Existe' : '❌ No existe'}`);
        console.log(`   stock: ${hasStockColumn ? '✅ Existe' : '❌ No existe'}`);
        
        // Paso 2: Agregar la columna stock si no existe
        if (!hasStockColumn) {
            console.log('\n🔨 PASO 2: Agregando columna "stock"');
            await pool.execute(`
                ALTER TABLE products 
                ADD COLUMN stock INT DEFAULT 0 COMMENT 'Stock quantity for inventory management'
            `);
            console.log('✅ Columna "stock" agregada exitosamente');
        } else {
            console.log('\n✅ PASO 2: La columna "stock" ya existe');
        }
        
        // Paso 3: Agregar algunos datos de ejemplo para testing
        console.log('\n📦 PASO 3: Agregando stock de ejemplo a productos LIQUIPOPS');
        
        // Buscar productos LIQUIPOPS
        const [liquipopsProducts] = await pool.execute(`
            SELECT id, product_name, available_quantity, stock 
            FROM products 
            WHERE product_name LIKE '%LIQUIPOPS%' 
            LIMIT 10
        `);
        
        console.log(`   Encontrados ${liquipopsProducts.length} productos LIQUIPOPS`);
        
        // Actualizar con stock de ejemplo
        for (const product of liquipopsProducts) {
            const sampleStock = Math.floor(Math.random() * 500) + 50; // Stock entre 50 y 550
            const sampleAvailableQty = Math.floor(Math.random() * 300) + 20; // Available entre 20 y 320
            
            await pool.execute(`
                UPDATE products 
                SET stock = ?, available_quantity = ? 
                WHERE id = ?
            `, [sampleStock, sampleAvailableQty, product.id]);
            
            console.log(`   📦 ${product.product_name.substring(0, 50)}...`);
            console.log(`      stock: ${sampleStock}, available_quantity: ${sampleAvailableQty}`);
        }
        
        // Paso 4: Verificar la estructura final
        console.log('\n🔍 PASO 4: Verificando estructura final');
        const [finalColumns] = await pool.execute('DESCRIBE products');
        
        const finalHasStock = finalColumns.some(col => col.Field === 'stock');
        const finalHasAvailable = finalColumns.some(col => col.Field === 'available_quantity');
        
        console.log(`   available_quantity: ${finalHasAvailable ? '✅' : '❌'}`);
        console.log(`   stock: ${finalHasStock ? '✅' : '❌'}`);
        
        // Paso 5: Mostrar algunos productos con stock
        console.log('\n📈 PASO 5: Productos con stock actualizado');
        const [stockProducts] = await pool.execute(`
            SELECT product_name, available_quantity, stock, category 
            FROM products 
            WHERE (available_quantity > 0 OR stock > 0) 
            LIMIT 5
        `);
        
        stockProducts.forEach(product => {
            console.log(`   📦 ${product.product_name}`);
            console.log(`      available_quantity: ${product.available_quantity}`);
            console.log(`      stock: ${product.stock}`);
            console.log(`      category: ${product.category}`);
        });
        
        console.log('\n🎉 RESUMEN:');
        console.log('✅ Columna "stock" agregada a la tabla products');
        console.log('✅ Datos de ejemplo agregados a productos LIQUIPOPS');
        console.log('✅ El backend API ahora puede retornar ambos campos');
        console.log('✅ El frontend puede mostrar niveles de stock correctos');
        
        console.log('\n💡 SIGUIENTE PASO:');
        console.log('   Reinicia el backend para aplicar los cambios y prueba la página de inventario');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

addMissingStockColumn();
