const mysql = require('mysql2/promise');

async function checkBarcodeStatus() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_de_pedidos'
    });

    try {
        console.log('='.repeat(80));
        console.log('INVESTIGACIÓN ESTADO ACTUAL DE CÓDIGOS DE BARRAS');
        console.log('='.repeat(80));

        // Consultar algunos productos para ver el estado actual
        const [products] = await connection.execute(`
            SELECT id, name, code, additional_fields_barcode, siigo_id 
            FROM products 
            WHERE is_active = 1
            ORDER BY id 
            LIMIT 10
        `);

        console.log('\nPrimeros 10 productos:');
        console.log('-'.repeat(80));
        products.forEach(product => {
            console.log(`ID: ${product.id}`);
            console.log(`Nombre: ${product.name}`);
            console.log(`Código Interno: ${product.code}`);
            console.log(`Código de Barras SIIGO: ${product.additional_fields_barcode}`);
            console.log(`SIIGO ID: ${product.siigo_id}`);
            console.log('-'.repeat(40));
        });

        // Contar productos por tipo de código de barras
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                SUM(CASE WHEN additional_fields_barcode IS NOT NULL AND additional_fields_barcode != '' AND additional_fields_barcode != code THEN 1 ELSE 0 END) as with_real_siigo_barcode,
                SUM(CASE WHEN additional_fields_barcode = code THEN 1 ELSE 0 END) as barcode_equals_code,
                SUM(CASE WHEN additional_fields_barcode IS NULL OR additional_fields_barcode = '' THEN 1 ELSE 0 END) as no_barcode,
                SUM(CASE WHEN additional_fields_barcode LIKE 'LIQ-%' THEN 1 ELSE 0 END) as generated_barcodes
            FROM products 
            WHERE is_active = 1
        `);

        console.log('\nEstadísticas de códigos de barras:');
        console.log(`Total productos activos: ${stats[0].total_products}`);
        console.log(`Con código de barras real de SIIGO: ${stats[0].with_real_siigo_barcode}`);
        console.log(`Código de barras = código interno: ${stats[0].barcode_equals_code}`);
        console.log(`Sin código de barras: ${stats[0].no_barcode}`);
        console.log(`Códigos generados (LIQ-*): ${stats[0].generated_barcodes}`);

        // Ver algunos ejemplos de cada tipo
        console.log('\n='.repeat(80));
        console.log('EJEMPLOS DE PRODUCTOS POR TIPO DE CÓDIGO:');
        console.log('='.repeat(80));

        // Productos con códigos reales de SIIGO
        const [realSiigo] = await connection.execute(`
            SELECT name, code, additional_fields_barcode 
            FROM products 
            WHERE is_active = 1 
            AND additional_fields_barcode IS NOT NULL 
            AND additional_fields_barcode != '' 
            AND additional_fields_barcode != code
            AND additional_fields_barcode NOT LIKE 'LIQ-%'
            LIMIT 5
        `);
        console.log('\nProductos con códigos reales de SIIGO:');
        realSiigo.forEach(p => console.log(`- ${p.name}: "${p.additional_fields_barcode}" (código: ${p.code})`));

        // Productos con códigos iguales al código interno
        const [sameAsCode] = await connection.execute(`
            SELECT name, code, additional_fields_barcode 
            FROM products 
            WHERE is_active = 1 AND additional_fields_barcode = code 
            LIMIT 5
        `);
        console.log('\nProductos con código de barras = código interno (PROBLEMÁTICO):');
        sameAsCode.forEach(p => console.log(`- ${p.name}: "${p.additional_fields_barcode}" = ${p.code}`));

        // Productos sin código de barras
        const [noBarcodes] = await connection.execute(`
            SELECT name, code, additional_fields_barcode 
            FROM products 
            WHERE is_active = 1 
            AND (additional_fields_barcode IS NULL OR additional_fields_barcode = '')
            LIMIT 5
        `);
        console.log('\nProductos sin código de barras:');
        noBarcodes.forEach(p => console.log(`- ${p.name}: "${p.additional_fields_barcode}" (código: ${p.code})`));

    } finally {
        await connection.end();
    }
}

checkBarcodeStatus().catch(console.error);
