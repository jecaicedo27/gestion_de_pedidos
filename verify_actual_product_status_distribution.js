const mysql = require('mysql2/promise');

async function verifyProductStatusDistribution() {
    console.log('🔍 VERIFICANDO DISTRIBUCIÓN REAL DE ESTADOS DE PRODUCTOS');
    console.log('=' * 60);
    
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        // 1. Verificar conteo total de productos por estado
        console.log('📊 CONTEO POR ESTADO:');
        const [statusCount] = await connection.execute(`
            SELECT 
                is_active,
                COUNT(*) as total,
                CASE 
                    WHEN is_active = 1 THEN 'ACTIVOS'
                    WHEN is_active = 0 THEN 'INACTIVOS'
                    ELSE 'ESTADO DESCONOCIDO'
                END as estado_descripcion
            FROM products 
            GROUP BY is_active 
            ORDER BY is_active DESC
        `);
        
        console.table(statusCount);

        // 2. Mostrar algunos productos inactivos específicos
        console.log('\n🔍 MUESTRA DE PRODUCTOS INACTIVOS:');
        const [inactiveProducts] = await connection.execute(`
            SELECT 
                internal_code,
                product_name,
                is_active,
                created_at,
                last_sync_at
            FROM products 
            WHERE is_active = 0 
            ORDER BY internal_code 
            LIMIT 20
        `);
        
        console.table(inactiveProducts);

        // 3. Verificar productos específicos que deberían estar inactivos
        console.log('\n🧪 VERIFICANDO PRODUCTOS ESPECÍFICOS (MP, LIQUI, etc.):');
        const [specificProducts] = await connection.execute(`
            SELECT 
                internal_code,
                product_name,
                is_active,
                category,
                CASE 
                    WHEN is_active = 1 THEN '✅ ACTIVO'
                    WHEN is_active = 0 THEN '❌ INACTIVO'
                END as status_display
            FROM products 
            WHERE internal_code LIKE 'MP%' OR internal_code LIKE 'LIQUI%' 
            ORDER BY internal_code 
            LIMIT 25
        `);
        
        console.table(specificProducts);

        // 4. Verificar si hay productos que se crearon recientemente
        console.log('\n📅 PRODUCTOS IMPORTADOS RECIENTEMENTE:');
        const [recentProducts] = await connection.execute(`
            SELECT 
                internal_code,
                product_name,
                is_active,
                created_at,
                CASE 
                    WHEN is_active = 1 THEN '✅ ACTIVO'
                    WHEN is_active = 0 THEN '❌ INACTIVO'
                END as status_display
            FROM products 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY created_at DESC 
            LIMIT 15
        `);
        
        console.table(recentProducts);

        // 5. Verificar el filtro del frontend
        console.log('\n🎯 VERIFICANDO CONSULTA SIMILAR AL FRONTEND:');
        const [frontendQuery] = await connection.execute(`
            SELECT 
                COUNT(*) as total_visible_frontend
            FROM products 
            WHERE is_active = 1
        `);
        
        console.log(`📱 Productos que ve el frontend (solo activos): ${frontendQuery[0].total_visible_frontend}`);

        // 6. Consulta completa incluyendo inactivos
        const [allProducts] = await connection.execute(`
            SELECT 
                COUNT(*) as total_all_products
            FROM products
        `);
        
        console.log(`📦 Total productos en BD (activos + inactivos): ${allProducts[0].total_all_products}`);

        console.log('\n' + '=' * 60);
        console.log('✅ VERIFICACIÓN COMPLETA');

    } catch (error) {
        console.error('❌ Error verificando productos:', error);
    } finally {
        await connection.end();
    }
}

verifyProductStatusDistribution();
