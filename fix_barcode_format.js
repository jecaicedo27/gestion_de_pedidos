const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

// Función para generar código de barras numérico válido
function generateValidBarcode(productId, index = 0) {
    // Usar timestamp actual + índice para garantizar unicidad
    const timestamp = (Date.now() + index).toString().slice(-8); // Últimos 8 dígitos
    const idHash = productId.toString().replace(/[^0-9]/g, '').slice(-4) || '0000'; // Solo números del ID
    const barcode = `77${timestamp}${idHash.padStart(4, '0')}`.slice(0, 13);
    
    // Asegurar que tenga exactamente 13 dígitos
    return barcode.padEnd(13, '0').slice(0, 13);
}

async function fixBarcodeFormats() {
    try {
        console.log('🔧 Conectando a la base de datos...');
        const connection = await mysql.createConnection(dbConfig);
        
        console.log('📋 Buscando códigos de barras con formato incorrecto...');
        
        // Encontrar todos los productos con códigos de barras que contengan "SIIGO_"
        const [invalidBarcodes] = await connection.execute(`
            SELECT id, product_name, barcode, siigo_product_id
            FROM products 
            WHERE barcode LIKE 'SIIGO_%'
            ORDER BY id ASC
        `);
        
        if (invalidBarcodes.length === 0) {
            console.log('✅ No se encontraron códigos de barras con formato incorrecto');
            await connection.end();
            return;
        }
        
        console.log(`❌ Encontrados ${invalidBarcodes.length} códigos de barras con formato incorrecto`);
        console.log('🔧 Iniciando corrección...\n');
        
        let correctedCount = 0;
        
        for (let i = 0; i < invalidBarcodes.length; i++) {
            const product = invalidBarcodes[i];
            
            // Generar nuevo código de barras numérico único
            let newBarcode = generateValidBarcode(product.id, i);
            
            // Verificar que no existe ya en la base de datos
            let attempts = 0;
            let isUnique = false;
            
            while (!isUnique && attempts < 100) {
                const [existing] = await connection.execute(
                    'SELECT id FROM products WHERE barcode = ? AND id != ?',
                    [newBarcode, product.id]
                );
                
                if (existing.length === 0) {
                    isUnique = true;
                } else {
                    attempts++;
                    newBarcode = generateValidBarcode(product.id, i + attempts);
                }
            }
            
            if (isUnique) {
                // Actualizar el código de barras
                await connection.execute(`
                    UPDATE products 
                    SET barcode = ?
                    WHERE id = ?
                `, [newBarcode, product.id]);
                
                console.log(`✅ Producto ID ${product.id}: "${product.product_name}"`);
                console.log(`   📧 Anterior: ${product.barcode}`);
                console.log(`   📦 Nuevo: ${newBarcode}\n`);
                
                correctedCount++;
            } else {
                console.log(`❌ No se pudo generar código único para producto ID ${product.id}`);
            }
        }
        
        console.log(`\n🏁 Corrección completada:`);
        console.log(`   ✅ Códigos corregidos: ${correctedCount}`);
        console.log(`   📊 Total procesados: ${invalidBarcodes.length}`);
        
        // Verificar que no queden códigos inválidos
        const [remaining] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM products 
            WHERE barcode LIKE 'SIIGO_%'
        `);
        
        if (remaining[0].count === 0) {
            console.log('✅ Todos los códigos de barras ahora tienen formato numérico válido');
        } else {
            console.log(`⚠️  Aún quedan ${remaining[0].count} códigos con formato incorrecto`);
        }
        
        await connection.end();
        console.log('\n🎉 Proceso completado exitosamente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Ejecutar corrección
fixBarcodeFormats();
