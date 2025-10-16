const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugBarcodeIssue() {
    console.log('🔍 Investigando problema de códigos de barras...\n');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gestion_pedidos_dev',
        port: process.env.DB_PORT || 3306
    });

    try {
        // Verificar algunos productos con problemas evidentes
        console.log('📋 Verificando productos con códigos de barras problemáticos:\n');
        
        const [products] = await connection.execute(`
            SELECT id, product_name, internal_code, barcode, siigo_id 
            FROM products 
            WHERE barcode LIKE 'P-%' OR barcode = internal_code
            LIMIT 10
        `);

        console.log('Productos con códigos de barras que coinciden con códigos internos:');
        products.forEach((product, index) => {
            console.log(`${index + 1}. ID: ${product.id}`);
            console.log(`   Producto: ${product.product_name}`);
            console.log(`   Código interno: ${product.internal_code}`);
            console.log(`   Código de barras: ${product.barcode}`);
            console.log(`   SIIGO ID: ${product.siigo_id}`);
            console.log(`   ❌ Problema: ${product.barcode === product.internal_code ? 'Códigos idénticos' : 'Barcode parece ser código interno'}`);
            console.log('');
        });

        // Contar cuántos productos tienen este problema
        const [count] = await connection.execute(`
            SELECT COUNT(*) as total 
            FROM products 
            WHERE barcode = internal_code OR barcode LIKE 'P-%' OR barcode LIKE 'IMPL%' OR barcode LIKE 'ACT%'
        `);

        console.log(`\n📊 Total de productos con problema de códigos de barras: ${count[0].total}`);

        // Verificar productos que podrían tener códigos de barras correctos
        const [goodProducts] = await connection.execute(`
            SELECT id, product_name, internal_code, barcode, siigo_id 
            FROM products 
            WHERE barcode NOT LIKE 'P-%' 
            AND barcode NOT LIKE 'IMPL%' 
            AND barcode NOT LIKE 'ACT%'
            AND barcode != internal_code 
            AND barcode IS NOT NULL 
            AND barcode != ''
            LIMIT 5
        `);

        if (goodProducts.length > 0) {
            console.log('\n✅ Productos que parecen tener códigos de barras correctos:');
            goodProducts.forEach((product, index) => {
                console.log(`${index + 1}. ${product.product_name}`);
                console.log(`   Código interno: ${product.internal_code}`);
                console.log(`   Código de barras: ${product.barcode}`);
                console.log('');
            });
        } else {
            console.log('\n⚠️  No se encontraron productos con códigos de barras que parezcan correctos');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await connection.end();
    }
}

debugBarcodeIssue().catch(console.error);
