const { pool } = require('./backend/config/database');

async function checkProductsTableStructure() {
    console.log('🔍 Checking Products Table Structure');
    console.log('=' .repeat(60));
    
    try {
        // Verificar estructura de la tabla products
        console.log('📊 ESTRUCTURA DE LA TABLA products:');
        const [columns] = await pool.execute(`
            DESCRIBE products
        `);
        
        console.log('\n📋 Columnas existentes:');
        columns.forEach(column => {
            console.log(`   🔹 ${column.Field} (${column.Type}) - ${column.Null} - ${column.Key}`);
        });
        
        // Verificar si existen columnas de stock
        const stockColumns = columns.filter(col => 
            col.Field.includes('stock') || 
            col.Field.includes('quantity') || 
            col.Field.includes('inventory')
        );
        
        console.log('\n📦 COLUMNAS RELACIONADAS CON STOCK:');
        if (stockColumns.length > 0) {
            stockColumns.forEach(col => {
                console.log(`   ✅ ${col.Field} (${col.Type})`);
            });
        } else {
            console.log('   ❌ No se encontraron columnas de stock/inventory');
        }
        
        // Verificar algunos productos para ver qué datos tienen
        console.log('\n📈 MUESTRA DE PRODUCTOS:');
        const [products] = await pool.execute(`
            SELECT * FROM products LIMIT 3
        `);
        
        if (products.length > 0) {
            console.log('Columnas disponibles:', Object.keys(products[0]));
            
            products.forEach((product, index) => {
                console.log(`\n   📦 Producto ${index + 1}: ${product.product_name}`);
                Object.keys(product).forEach(key => {
                    if (key.includes('stock') || key.includes('quantity') || key.includes('inventory')) {
                        console.log(`      ${key}: ${product[key]}`);
                    }
                });
            });
        }
        
        console.log('\n🔧 DIAGNÓSTICO:');
        const hasStock = columns.some(col => col.Field === 'stock');
        const hasAvailableQuantity = columns.some(col => col.Field === 'available_quantity');
        
        if (hasStock) {
            console.log('✅ Columna "stock" existe');
        } else {
            console.log('❌ Columna "stock" NO existe');
        }
        
        if (hasAvailableQuantity) {
            console.log('✅ Columna "available_quantity" existe');
        } else {
            console.log('❌ Columna "available_quantity" NO existe');
        }
        
        console.log('\n💡 RECOMENDACIÓN:');
        if (!hasStock && !hasAvailableQuantity) {
            console.log('🔨 Necesitas agregar las columnas de stock a la tabla products');
            console.log('   Comandos SQL sugeridos:');
            console.log('   ALTER TABLE products ADD COLUMN stock INT DEFAULT 0;');
            console.log('   ALTER TABLE products ADD COLUMN available_quantity INT DEFAULT 0;');
        } else if (!hasStock) {
            console.log('🔨 Necesitas agregar la columna "stock" a la tabla products');
            console.log('   Comando SQL: ALTER TABLE products ADD COLUMN stock INT DEFAULT 0;');
        } else if (!hasAvailableQuantity) {
            console.log('🔨 Necesitas agregar la columna "available_quantity" a la tabla products');
            console.log('   Comando SQL: ALTER TABLE products ADD COLUMN available_quantity INT DEFAULT 0;');
        } else {
            console.log('✅ Las columnas de stock existen, el problema puede estar en otros lados');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkProductsTableStructure();
