const { query } = require('./backend/config/database');

async function addStockDemoData() {
    console.log('📦 AGREGANDO DATOS DE STOCK PARA DEMO');
    console.log('====================================');

    try {
        // 1. Obtener algunos productos para agregar stock
        console.log('1️⃣ Obteniendo productos para agregar stock...');
        
        const products = await query(`
            SELECT id, product_name, barcode, category 
            FROM products 
            WHERE barcode NOT LIKE '%COMPANY%' 
            ORDER BY created_at DESC 
            LIMIT 20
        `);

        console.log(`📋 ${products.length} productos encontrados`);

        // 2. Agregar stock aleatorio a los productos
        console.log('\n2️⃣ Agregando stock aleatorio...');
        
        let updatedCount = 0;
        for (const product of products) {
            // Generar stock aleatorio entre 10 y 500
            const randomStock = Math.floor(Math.random() * 490) + 10;
            const availableQuantity = Math.floor(randomStock * 0.8); // 80% disponible
            
            await query(`
                UPDATE products 
                SET stock = ?, available_quantity = ?, updated_at = NOW()
                WHERE id = ?
            `, [randomStock, availableQuantity, product.id]);
            
            console.log(`   ✅ ${product.product_name}: Stock ${randomStock}, Disponible ${availableQuantity}`);
            updatedCount++;
        }

        // 3. Agregar stock específico a algunos productos LIQUIPOPS
        console.log('\n3️⃣ Agregando stock específico a productos LIQUIPOPS...');
        
        const liquipops = await query(`
            SELECT id, product_name, barcode 
            FROM products 
            WHERE category = 'LIQUIPOPS' 
            LIMIT 10
        `);

        for (const product of liquipops) {
            // Stock más alto para productos populares
            const highStock = Math.floor(Math.random() * 200) + 100;
            const availableQuantity = Math.floor(highStock * 0.9);
            
            await query(`
                UPDATE products 
                SET stock = ?, available_quantity = ?, updated_at = NOW()
                WHERE id = ?
            `, [highStock, availableQuantity, product.id]);
            
            console.log(`   🍭 ${product.product_name}: Stock ${highStock}, Disponible ${availableQuantity}`);
            updatedCount++;
        }

        // 4. Agregar algunos productos con stock bajo para demo
        console.log('\n4️⃣ Agregando productos con stock bajo...');
        
        const lowStockProducts = await query(`
            SELECT id, product_name, barcode 
            FROM products 
            WHERE stock IS NULL 
            ORDER BY RAND() 
            LIMIT 5
        `);

        for (const product of lowStockProducts) {
            // Stock bajo entre 1 y 10
            const lowStock = Math.floor(Math.random() * 9) + 1;
            const availableQuantity = Math.floor(lowStock * 0.7);
            
            await query(`
                UPDATE products 
                SET stock = ?, available_quantity = ?, updated_at = NOW()
                WHERE id = ?
            `, [lowStock, availableQuantity, product.id]);
            
            console.log(`   ⚠️ ${product.product_name}: Stock BAJO ${lowStock}, Disponible ${availableQuantity}`);
            updatedCount++;
        }

        // 5. Verificar resultados
        console.log('\n5️⃣ Verificando resultados...');
        
        const stockStats = await query(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN stock > 0 THEN 1 END) as with_stock,
                COUNT(CASE WHEN stock IS NULL THEN 1 END) as without_stock,
                COUNT(CASE WHEN stock <= 10 THEN 1 END) as low_stock,
                AVG(stock) as avg_stock,
                MAX(stock) as max_stock,
                MIN(stock) as min_stock
            FROM products
        `);

        const stats = stockStats[0];
        
        console.log('📊 ESTADÍSTICAS DE STOCK:');
        console.log(`   Total productos: ${stats.total_products}`);
        console.log(`   Con stock: ${stats.with_stock}`);
        console.log(`   Sin stock: ${stats.without_stock}`);
        console.log(`   Stock bajo (≤10): ${stats.low_stock}`);
        console.log(`   Promedio stock: ${Math.round(stats.avg_stock || 0)}`);
        console.log(`   Stock máximo: ${stats.max_stock || 0}`);
        console.log(`   Stock mínimo: ${stats.min_stock || 0}`);

        // 6. Mostrar muestra de productos con stock
        console.log('\n6️⃣ Muestra de productos con stock:');
        
        const sampleWithStock = await query(`
            SELECT product_name, barcode, category, stock, available_quantity
            FROM products 
            WHERE stock IS NOT NULL 
            ORDER BY stock DESC 
            LIMIT 10
        `);

        sampleWithStock.forEach((product, index) => {
            console.log(`   ${index + 1}. ${product.product_name}`);
            console.log(`      Stock: ${product.stock}, Disponible: ${product.available_quantity}`);
            console.log(`      Categoría: ${product.category}`);
            console.log('');
        });

        console.log(`✅ ${updatedCount} productos actualizados con stock de demo`);

    } catch (error) {
        console.error('❌ Error agregando stock de demo:', error.message);
    }
}

// Ejecutar script
addStockDemoData().then(() => {
    console.log('\n✅ Stock de demo agregado exitosamente');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
