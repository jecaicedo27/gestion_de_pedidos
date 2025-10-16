const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function fixExistingBarcodes() {
    try {
        console.log('🔧 Conectando a la base de datos...');
        const connection = await mysql.createConnection(dbConfig);
        
        console.log('🔍 Buscando códigos de barras generados automáticamente...');
        
        // Encontrar todos los productos con códigos de barras numéricos de 13 dígitos que empiecen con "77"
        // Estos son los códigos que se generaron automáticamente y no vienen de SIIGO
        const [generatedBarcodes] = await connection.execute(`
            SELECT id, product_name, barcode, siigo_product_id
            FROM products 
            WHERE barcode REGEXP '^77[0-9]{11}$'
            AND LENGTH(barcode) = 13
            ORDER BY id ASC
        `);
        
        if (generatedBarcodes.length === 0) {
            console.log('✅ No se encontraron códigos de barras generados automáticamente');
            await connection.end();
            return;
        }
        
        console.log(`❌ Encontrados ${generatedBarcodes.length} códigos de barras generados automáticamente`);
        console.log('🔧 Cambiando a "PENDIENTE"...\n');
        
        let updatedCount = 0;
        
        for (const product of generatedBarcodes) {
            try {
                // Actualizar el código de barras a "PENDIENTE"
                await connection.execute(`
                    UPDATE products 
                    SET barcode = 'PENDIENTE'
                    WHERE id = ?
                `, [product.id]);
                
                console.log(`✅ Producto ID ${product.id}: "${product.product_name}"`);
                console.log(`   📧 Cambio: ${product.barcode} → PENDIENTE\n`);
                
                updatedCount++;
                
            } catch (productError) {
                console.error(`❌ Error actualizando producto ${product.id}:`, productError.message);
            }
        }
        
        console.log(`\n🏁 Actualización completada:`);
        console.log(`   ✅ Productos actualizados: ${updatedCount}`);
        console.log(`   📊 Total procesados: ${generatedBarcodes.length}`);
        
        // Verificar estado final
        const [finalCount] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM products 
            WHERE barcode = 'PENDIENTE'
        `);
        
        console.log(`📈 Total productos con código "PENDIENTE": ${finalCount[0].count}`);
        
        await connection.end();
        console.log('\n🎉 Proceso completado exitosamente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Ejecutar corrección
fixExistingBarcodes();
