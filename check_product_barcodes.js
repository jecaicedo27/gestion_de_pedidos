const mysql = require('mysql2/promise');

async function checkProductBarcodes() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });
    
    try {
        console.log('🔍 Verificando estructura de la tabla products...\n');
        
        // Primero verificar la estructura de la tabla
        const [columns] = await connection.execute(
            'SHOW COLUMNS FROM products'
        );
        
        console.log('📊 Columnas de la tabla products:');
        columns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });
        
        // Buscar productos LIQUIPOPS con sus códigos de barras
        const [products] = await connection.execute(
            'SELECT id, product_name, internal_code, barcode, siigo_product_id FROM products WHERE product_name LIKE "%LIQUIPOP%" ORDER BY product_name LIMIT 10'
        );
        
        console.log('\n📦 Productos LIQUIPOPS encontrados:');
        console.log('================================================');
        products.forEach(p => {
            console.log(`ID: ${p.id}`);
            console.log(`Nombre: ${p.product_name}`);
            console.log(`Código interno: ${p.internal_code || 'N/A'}`);
            console.log(`Código SIIGO: ${p.siigo_product_id || 'N/A'}`);
            console.log(`📊 Código de Barras: ${p.barcode || 'SIN CÓDIGO'}`);
            console.log('------------------------------------------------');
        });
        
        // Verificar específicamente los productos del pedido mostrado
        console.log('\n🎯 Productos específicos del pedido mostrado:');
        console.log('================================================');
        
        const specificProducts = [
            'LIQUIPOPS SABOR A CEREZA',
            'LIQUIPOPS SABOR A MARACUYA',
            'LIQUIPOPS SABOR A MANGO BICHE'
        ];
        
        for (const productName of specificProducts) {
            const [product] = await connection.execute(
                'SELECT * FROM products WHERE product_name LIKE ? LIMIT 1',
                [`%${productName}%`]
            );
            
            if (product.length > 0) {
                console.log(`\n🍬 ${product[0].product_name}`);
                console.log(`   Código interno: ${product[0].internal_code || 'N/A'}`);
                console.log(`   Código SIIGO: ${product[0].siigo_product_id || 'N/A'}`);
                console.log(`   Código de barras: ${product[0].barcode || 'NO TIENE'}`);
                console.log(`   ID: ${product[0].id}`);
            }
        }
        
        // Estadísticas generales
        const [stats] = await connection.execute(
            'SELECT COUNT(*) as total, SUM(CASE WHEN barcode IS NOT NULL AND barcode != "" THEN 1 ELSE 0 END) as con_barcode FROM products'
        );
        
        console.log('\n📊 Estadísticas de códigos de barras:');
        console.log(`   Total productos: ${stats[0].total}`);
        console.log(`   Con código de barras: ${stats[0].con_barcode}`);
        console.log(`   Sin código de barras: ${stats[0].total - stats[0].con_barcode}`);
        
    } finally {
        await connection.end();
    }
}

checkProductBarcodes().catch(console.error);
