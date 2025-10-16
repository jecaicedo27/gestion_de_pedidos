const mysql = require('mysql2/promise');

async function fixBarcodeIssuesCorrect() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_de_pedidos'
    });

    try {
        console.log('='.repeat(80));
        console.log('CORRIGIENDO CÓDIGOS DE BARRAS CORRECTAMENTE');
        console.log('SOLO generar códigos para productos SIN código de barras de SIIGO');
        console.log('MANTENER códigos reales que vengan de SIIGO');
        console.log('='.repeat(80));

        // Identificar productos que necesitan códigos de barras únicos
        const [productsNeedingBarcodes] = await connection.execute(`
            SELECT id, name, code, additional_fields_barcode 
            FROM products 
            WHERE is_active = 1 
            AND (additional_fields_barcode IS NULL OR additional_fields_barcode = '' OR additional_fields_barcode = code)
            ORDER BY id
        `);

        console.log(`\nProductos que necesitan códigos de barras únicos: ${productsNeedingBarcodes.length}`);
        
        if (productsNeedingBarcodes.length === 0) {
            console.log('✅ Todos los productos ya tienen códigos de barras válidos');
            return;
        }

        console.log('\nProductos que se van a corregir:');
        productsNeedingBarcodes.forEach(product => {
            console.log(`- ID ${product.id}: ${product.name} (código: ${product.code}) - barcode actual: "${product.additional_fields_barcode}"`);
        });

        // Confirmar antes de proceder
        console.log('\n' + '='.repeat(80));
        console.log('¿PROCEDER CON LA CORRECCIÓN?');
        console.log('Se van a generar códigos únicos SOLO para productos sin códigos reales de SIIGO');
        console.log('Los códigos reales de SIIGO se mantendrán intactos');
        console.log('='.repeat(80));
        
        // Generar códigos únicos para productos sin códigos de barras
        let processedCount = 0;
        const timestamp = Date.now();
        
        console.log('\nProcesando productos...');
        
        for (const product of productsNeedingBarcodes) {
            // Generar código único con formato: LIQ-TIMESTAMP-ID
            const uniqueBarcode = `LIQ-${timestamp}-${String(product.id).padStart(3, '0')}`;
            
            try {
                await connection.execute(`
                    UPDATE products 
                    SET additional_fields_barcode = ? 
                    WHERE id = ?
                `, [uniqueBarcode, product.id]);

                console.log(`✅ Producto ${product.id} (${product.name}): nuevo código "${uniqueBarcode}"`);
                processedCount++;
                
                // Pequeña pausa para evitar saturar la base de datos
                await new Promise(resolve => setTimeout(resolve, 10));
                
            } catch (error) {
                console.error(`❌ Error procesando producto ${product.id}: ${error.message}`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('RESUMEN DE CORRECCIÓN:');
        console.log(`✅ Productos procesados exitosamente: ${processedCount}`);
        console.log(`❌ Productos con errores: ${productsNeedingBarcodes.length - processedCount}`);
        
        // Verificación final
        console.log('\nVERIFICACIÓN FINAL:');
        const [finalStats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                SUM(CASE WHEN additional_fields_barcode IS NOT NULL AND additional_fields_barcode != '' AND additional_fields_barcode != code THEN 1 ELSE 0 END) as with_valid_barcode,
                SUM(CASE WHEN additional_fields_barcode IS NULL OR additional_fields_barcode = '' OR additional_fields_barcode = code THEN 1 ELSE 0 END) as still_need_barcode
            FROM products 
            WHERE is_active = 1
        `);

        console.log(`Total productos activos: ${finalStats[0].total_products}`);
        console.log(`Con códigos de barras válidos: ${finalStats[0].with_valid_barcode}`);
        console.log(`Que aún necesitan códigos: ${finalStats[0].still_need_barcode}`);
        
        if (finalStats[0].still_need_barcode === 0) {
            console.log('🎉 TODOS LOS PRODUCTOS TIENEN CÓDIGOS DE BARRAS ÚNICOS!');
        }

    } finally {
        await connection.end();
    }
}

fixBarcodeIssuesCorrect().catch(console.error);
