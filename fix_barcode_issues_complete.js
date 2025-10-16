const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixBarcodeIssues() {
    console.log('🔧 Corrigiendo problemas de códigos de barras...\n');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gestion_pedidos_dev',
        port: process.env.DB_PORT || 3306
    });

    try {
        // 1. Identificar productos con códigos de barras problemáticos
        console.log('🔍 Identificando productos con códigos de barras problemáticos...');
        
        const [problematicProducts] = await connection.execute(`
            SELECT id, product_name, internal_code, barcode, siigo_id 
            FROM products 
            WHERE barcode = internal_code 
            OR barcode LIKE 'P-%' 
            OR barcode LIKE 'IMPL%' 
            OR barcode LIKE 'ACT%'
            OR barcode LIKE 'MPV%'
            OR barcode LIKE 'GUD%'
            OR barcode LIKE 'CHAM%'
            ORDER BY id
        `);

        console.log(`📊 Productos con códigos de barras problemáticos: ${problematicProducts.length}`);

        if (problematicProducts.length === 0) {
            console.log('✅ No se encontraron productos con problemas de códigos de barras');
            return;
        }

        // 2. Generar función para crear códigos de barras únicos
        function generateUniqueBarcode(product, index) {
            const timestamp = Date.now().toString().slice(-6);
            const paddedIndex = (index + 1).toString().padStart(4, '0');
            
            // Crear un prefijo basado en la categoría o nombre del producto
            let prefix = 'PROD';
            if (product.internal_code) {
                // Usar las primeras 3 letras del código interno
                prefix = product.internal_code.substring(0, 3).toUpperCase();
            } else if (product.product_name) {
                // Usar las primeras 3 letras del nombre del producto
                const words = product.product_name.split(' ');
                prefix = words[0].substring(0, 3).toUpperCase();
            }

            // Formato: PREFIJO-TIMESTAMP-INDEX (ej: MPV-123456-0001)
            return `${prefix}-${timestamp}-${paddedIndex}`;
        }

        // 3. Actualizar cada producto con un código de barras único
        console.log('🔄 Actualizando códigos de barras...');
        let updatedCount = 0;
        const barcodeMap = new Map(); // Para evitar duplicados

        for (let i = 0; i < problematicProducts.length; i++) {
            const product = problematicProducts[i];
            let newBarcode;
            let attempts = 0;
            const maxAttempts = 10;

            // Generar código de barras único (evitar duplicados)
            do {
                newBarcode = generateUniqueBarcode(product, i + attempts);
                attempts++;
            } while (barcodeMap.has(newBarcode) && attempts < maxAttempts);

            if (attempts >= maxAttempts) {
                console.warn(`⚠️  No se pudo generar código único para producto ${product.id}`);
                continue;
            }

            barcodeMap.set(newBarcode, true);

            // Actualizar en la base de datos
            await connection.execute(`
                UPDATE products 
                SET barcode = ?, updated_at = NOW() 
                WHERE id = ?
            `, [newBarcode, product.id]);

            updatedCount++;

            console.log(`${i + 1}/${problematicProducts.length} - ${product.internal_code}: ${product.barcode} → ${newBarcode}`);

            // Rate limiting cada 50 productos
            if (i % 50 === 0 && i > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // 4. Verificar que no haya duplicados
        console.log('\n🔍 Verificando duplicados...');
        const [duplicates] = await connection.execute(`
            SELECT barcode, COUNT(*) as count 
            FROM products 
            GROUP BY barcode 
            HAVING COUNT(*) > 1
        `);

        if (duplicates.length > 0) {
            console.warn(`⚠️  Se encontraron ${duplicates.length} códigos de barras duplicados:`);
            duplicates.forEach(dup => {
                console.warn(`   - ${dup.barcode}: ${dup.count} productos`);
            });
        } else {
            console.log('✅ No se encontraron códigos de barras duplicados');
        }

        // 5. Mostrar estadísticas finales
        console.log('\n📊 RESUMEN DE CORRECCIÓN:');
        console.log(`✅ Productos actualizados: ${updatedCount}`);
        console.log(`📝 Productos con códigos únicos: ${barcodeMap.size}`);

        // 6. Verificar algunos productos actualizados
        console.log('\n🔍 Verificando productos actualizados (primeros 5):');
        const [verificationProducts] = await connection.execute(`
            SELECT id, product_name, internal_code, barcode 
            FROM products 
            WHERE barcode != internal_code 
            LIMIT 5
        `);

        verificationProducts.forEach((product, index) => {
            console.log(`${index + 1}. ${product.product_name}`);
            console.log(`   Código interno: ${product.internal_code}`);
            console.log(`   Código de barras: ${product.barcode}`);
            console.log(`   ✅ Diferentes: ${product.internal_code !== product.barcode}`);
            console.log('');
        });

        // 7. Contar productos aún problemáticos
        const [remainingProblems] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM products 
            WHERE barcode = internal_code
        `);

        console.log(`\n📊 Productos restantes con código de barras igual al interno: ${remainingProblems[0].count}`);

        console.log('\n🎉 CORRECCIÓN DE CÓDIGOS DE BARRAS COMPLETADA');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await connection.end();
    }
}

fixBarcodeIssues().catch(console.error);
