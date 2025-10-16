const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function verifyLiquipp06Fixed() {
    let connection;
    try {
        console.log('🔍 Verificando el producto LIQUIPP06 después de la migración...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Buscar el producto LIQUIPP06
        const [products] = await connection.execute(`
            SELECT id, product_name, barcode, siigo_product_id, internal_code, category, is_active
            FROM products 
            WHERE internal_code = 'LIQUIPP06'
        `);
        
        if (products.length === 0) {
            console.log('❌ No se encontró producto LIQUIPP06 después de la migración');
            return;
        }
        
        const product = products[0];
        console.log('\n📦 PRODUCTO LIQUIPP06 DESPUÉS DE LA MIGRACIÓN:');
        console.log(`   🆔 ID: ${product.id}`);
        console.log(`   📝 Nombre: ${product.product_name}`);
        console.log(`   📧 Código de barras: ${product.barcode}`);
        console.log(`   🌐 SIIGO ID: ${product.siigo_product_id}`);
        console.log(`   🔢 Código interno: ${product.internal_code}`);
        console.log(`   📂 Categoría: ${product.category}`);
        console.log(`   ✅ Activo: ${product.is_active ? 'Sí' : 'No'}`);
        
        // Verificar si ahora tiene el código correcto
        if (product.barcode === '7709717533940') {
            console.log('\n🎉 ¡ÉXITO! El producto LIQUIPP06 ahora tiene su código de barras correcto');
            console.log('✨ Código corregido: 7709717533940 (extraído de additional_fields.barcode en SIIGO)');
            console.log('💡 El sistema ahora busca códigos de barras en múltiples campos de SIIGO');
        } else if (product.barcode.startsWith('PENDIENTE_')) {
            console.log('\n⚠️  El producto sigue marcado como PENDIENTE');
            console.log('🔍 Esto significa que no se encontró código de barras en ningún campo de SIIGO');
            console.log('   - Campo principal: product.barcode');
            console.log('   - Campo adicional: product.additional_fields.barcode'); 
            console.log('   - Metadata (legacy)');
        } else {
            console.log(`\n✅ El producto tiene código de barras: ${product.barcode}`);
        }
        
        // Mostrar estadísticas generales de la migración
        console.log('\n📊 ESTADÍSTICAS GENERALES DE LA MIGRACIÓN:');
        
        const [totalStats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_productos,
                COUNT(CASE WHEN barcode NOT LIKE 'PENDIENTE_%' THEN 1 END) as con_codigo,
                COUNT(CASE WHEN barcode LIKE 'PENDIENTE_%' THEN 1 END) as pendientes
            FROM products
        `);
        
        const stats = totalStats[0];
        console.log(`   📦 Total productos: ${stats.total_productos}`);
        console.log(`   ✅ Con código de barras: ${stats.con_codigo}`);
        console.log(`   ⏳ Pendientes: ${stats.pendientes}`);
        console.log(`   📊 Porcentaje con códigos: ${((stats.con_codigo / stats.total_productos) * 100).toFixed(1)}%`);
        
        // Mostrar algunos ejemplos de productos con códigos reales
        console.log('\n📧 PRODUCTOS CON CÓDIGOS DE BARRAS REALES:');
        const [withBarcodes] = await connection.execute(`
            SELECT internal_code, product_name, barcode
            FROM products 
            WHERE barcode NOT LIKE 'PENDIENTE_%'
            ORDER BY internal_code
            LIMIT 10
        `);
        
        withBarcodes.forEach(prod => {
            console.log(`   ✅ ${prod.internal_code}: ${prod.barcode}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar verificación
verifyLiquipp06Fixed();
