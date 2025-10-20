require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');

async function findAllInactiveProducts() {
    console.log('🔍 Buscando TODOS los productos que deberían estar inactivos...\n');

    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    };

    const connection = await mysql.createConnection(dbConfig);

    try {
        // 1. Buscar productos que probablemente estén inactivos por nombre
        console.log('📋 1. Buscando productos con nombres que indican inactividad...');
        
        const [suspiciousProducts] = await connection.execute(`
            SELECT internal_code, product_name, is_active, siigo_id
            FROM products 
            WHERE UPPER(product_name) LIKE '%INAVILITADO%' 
               OR UPPER(product_name) LIKE '%INACTIVO%' 
               OR UPPER(product_name) LIKE '%DESCONTINUADO%'
               OR UPPER(product_name) LIKE '%ELIMINADO%'
               OR UPPER(product_name) LIKE '%DESHABILITADO%'
            ORDER BY internal_code
        `);
        
        console.log(`🔍 Encontrados ${suspiciousProducts.length} productos con nombres sospechosos:`);
        suspiciousProducts.forEach(product => {
            const status = product.is_active ? '✅ ACTIVO (INCORRECTO)' : '❌ INACTIVO (CORRECTO)';
            console.log(`   ${product.internal_code}: ${product.product_name} - ${status}`);
        });

        // 2. Contar todos los productos por estado actual
        console.log('\n📊 2. Conteo actual de productos por estado:');
        
        const [statusCount] = await connection.execute(`
            SELECT 
                is_active,
                COUNT(*) as count,
                CASE WHEN is_active = 1 THEN 'ACTIVOS' ELSE 'INACTIVOS' END as estado
            FROM products 
            GROUP BY is_active
            ORDER BY is_active DESC
        `);
        
        statusCount.forEach(row => {
            console.log(`   ${row.estado}: ${row.count} productos`);
        });

        // 3. Buscar productos con códigos similares a los que ya sabemos que están inactivos
        console.log('\n📋 3. Buscando productos con códigos similares a los conocidos inactivos...');
        
        const [similarCodes] = await connection.execute(`
            SELECT internal_code, product_name, is_active
            FROM products 
            WHERE internal_code LIKE 'MP%' 
               OR internal_code LIKE 'SH%'
            ORDER BY internal_code
        `);
        
        const activeMP = similarCodes.filter(p => p.internal_code.startsWith('MP') && p.is_active === 1);
        const activeSH = similarCodes.filter(p => p.internal_code.startsWith('SH') && p.is_active === 1);
        const inactiveMP = similarCodes.filter(p => p.internal_code.startsWith('MP') && p.is_active === 0);
        const inactiveSH = similarCodes.filter(p => p.internal_code.startsWith('SH') && p.is_active === 0);
        
        console.log(`   📦 Productos MP: ${activeMP.length} activos, ${inactiveMP.length} inactivos`);
        console.log(`   📦 Productos SH: ${activeSH.length} activos, ${inactiveSH.length} inactivos`);
        
        // 4. Mostrar algunos productos MP activos para verificación manual
        if (activeMP.length > 0) {
            console.log('\n📋 4. Algunos productos MP activos (para verificación):');
            activeMP.slice(0, 10).forEach(product => {
                console.log(`   ${product.internal_code}: ${product.product_name}`);
            });
            if (activeMP.length > 10) {
                console.log(`   ... y ${activeMP.length - 10} más`);
            }
        }

        // 5. Buscar patrones en nombres de productos
        console.log('\n📋 5. Analizando patrones en nombres de productos...');
        
        const [patterns] = await connection.execute(`
            SELECT 
                SUBSTRING(product_name, 1, 10) as nombre_inicio,
                COUNT(*) as cantidad,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activos,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactivos
            FROM products 
            GROUP BY SUBSTRING(product_name, 1, 10)
            HAVING cantidad > 1
            ORDER BY inactivos DESC, cantidad DESC
            LIMIT 20
        `);
        
        console.log('   📊 Patrones de nombres (primeros 10 caracteres):');
        patterns.forEach(pattern => {
            console.log(`   "${pattern.nombre_inicio}": ${pattern.cantidad} total (${pattern.activos} activos, ${pattern.inactivos} inactivos)`);
        });

        // 6. Conclusiones y recomendaciones
        console.log('\n📋 6. ANÁLISIS Y RECOMENDACIONES:');
        console.log('=====================================');
        
        const totalSuspicious = suspiciousProducts.filter(p => p.is_active === 1).length;
        
        if (totalSuspicious > 0) {
            console.log(`\n⚠️  PRODUCTOS PROBLEMÁTICOS ENCONTRADOS: ${totalSuspicious}`);
            console.log('   Estos productos tienen nombres que sugieren que deberían estar inactivos');
            console.log('   pero están marcados como activos en la base de datos.');
        }
        
        console.log('\n🔧 PRÓXIMOS PASOS RECOMENDADOS:');
        console.log('1. Configurar credenciales SIIGO para verificación automática');
        console.log('2. Crear script de corrección masiva basado en datos de SIIGO');
        console.log('3. Implementar sincronización automática regular');
        
        if (totalSuspicious > 0) {
            console.log(`\n🎯 ACCIÓN INMEDIATA: Corregir ${totalSuspicious} productos identificados`);
            
            // Preparar lista para corrección
            const toFix = suspiciousProducts.filter(p => p.is_active === 1);
            if (toFix.length > 0) {
                console.log('\n📝 Lista de productos para corregir:');
                toFix.forEach(product => {
                    console.log(`   - ${product.internal_code}: ${product.product_name}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Error durante el análisis:', error.message);
    } finally {
        await connection.end();
    }
}

findAllInactiveProducts().catch(console.error);
