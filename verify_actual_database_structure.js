const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyDatabaseStructure() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gestion_pedidos_dev',
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('🔍 Verificando estructura real de la tabla products...');
        
        // Obtener estructura de la tabla
        const [columns] = await connection.execute(`
            DESCRIBE products
        `);

        console.log('\n📋 COLUMNAS DE LA TABLA PRODUCTS:');
        console.log('════════════════════════════════════════════');
        columns.forEach(col => {
            console.log(`${col.Field.padEnd(25)} ${col.Type.padEnd(20)} ${col.Null} ${col.Key} ${col.Default || 'NULL'}`);
        });

        console.log('\n🔍 Buscando productos con nombres relacionados a MP170...');
        const [products] = await connection.execute(`
            SELECT id, siigo_id, name, active, available_quantity
            FROM products 
            WHERE name LIKE '%MP170%' OR name LIKE '%INAVALIDADO%' OR siigo_id LIKE '%MP%'
            LIMIT 10
        `);

        console.log(`\n📦 Productos encontrados (${products.length}):`);
        if (products.length > 0) {
            products.forEach(product => {
                console.log(`- ID: ${product.id}, SIIGO_ID: ${product.siigo_id}, Nombre: ${product.name}, Activo: ${product.active}`);
            });
        } else {
            console.log('❌ No se encontraron productos relacionados');
        }

        console.log('\n📊 Estadísticas generales de productos:');
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN siigo_id IS NOT NULL THEN 1 END) as with_siigo_id,
                COUNT(CASE WHEN active = 1 THEN 1 END) as active_products,
                COUNT(CASE WHEN active = 0 THEN 1 END) as inactive_products,
                MAX(created_at) as last_created,
                MAX(updated_at) as last_updated
            FROM products
        `);

        const stat = stats[0];
        console.log(`- Total productos: ${stat.total_products}`);
        console.log(`- Con SIIGO ID: ${stat.with_siigo_id}`);
        console.log(`- Activos: ${stat.active_products}`);
        console.log(`- Inactivos: ${stat.inactive_products}`);
        console.log(`- Último creado: ${stat.last_created}`);
        console.log(`- Última actualización: ${stat.last_updated}`);

        // Verificar existencia de otras tablas relacionadas
        console.log('\n🔍 Verificando tabla webhook_logs...');
        try {
            const [webhookColumns] = await connection.execute(`DESCRIBE webhook_logs`);
            console.log('✅ Tabla webhook_logs existe');
            console.log('Columnas:', webhookColumns.map(col => col.Field).join(', '));
        } catch (error) {
            console.log('❌ Tabla webhook_logs no existe:', error.message);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await connection.end();
    }
}

verifyDatabaseStructure().catch(console.error);
