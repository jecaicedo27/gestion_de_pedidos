require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');

async function fixAllInactiveProductsMassive() {
    console.log('🚨 CORRECCIÓN MASIVA: Marcando todos los productos "INAVILITADO" como inactivos...\n');

    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    };

    const connection = await mysql.createConnection(dbConfig);

    try {
        // 1. Obtener todos los productos que deberían estar inactivos
        console.log('🔍 1. Identificando productos que necesitan corrección...');
        
        const [inactiveProducts] = await connection.execute(`
            SELECT internal_code, product_name, is_active, id
            FROM products 
            WHERE UPPER(product_name) LIKE '%INAVILITADO%' 
               OR UPPER(product_name) LIKE '%INACTIVO%' 
               OR UPPER(product_name) LIKE '%DESCONTINUADO%'
               OR UPPER(product_name) LIKE '%ELIMINADO%'
               OR UPPER(product_name) LIKE '%DESHABILITADO%'
            ORDER BY internal_code
        `);
        
        const needsFix = inactiveProducts.filter(product => product.is_active === 1);
        const alreadyFixed = inactiveProducts.filter(product => product.is_active === 0);
        
        console.log(`📊 Total productos identificados: ${inactiveProducts.length}`);
        console.log(`✅ Ya están correctos: ${alreadyFixed.length}`);
        console.log(`🔧 Necesitan corrección: ${needsFix.length}`);
        
        if (needsFix.length === 0) {
            console.log('✅ Todos los productos ya están correctamente marcados como inactivos!');
            return;
        }

        // 2. Confirmar la operación
        console.log(`\n⚠️  ATENCIÓN: Se van a marcar ${needsFix.length} productos como INACTIVOS`);
        console.log('📝 Algunos ejemplos:');
        needsFix.slice(0, 10).forEach(product => {
            console.log(`   - ${product.internal_code}: ${product.product_name}`);
        });
        if (needsFix.length > 10) {
            console.log(`   ... y ${needsFix.length - 10} productos más`);
        }

        // 3. Ejecutar la corrección masiva
        console.log('\n🔄 Ejecutando corrección masiva...');
        
        const updateResult = await connection.execute(`
            UPDATE products 
            SET is_active = 0 
            WHERE UPPER(product_name) LIKE '%INAVILITADO%' 
               OR UPPER(product_name) LIKE '%INACTIVO%' 
               OR UPPER(product_name) LIKE '%DESCONTINUADO%'
               OR UPPER(product_name) LIKE '%ELIMINADO%'
               OR UPPER(product_name) LIKE '%DESHABILITADO%'
        `);
        
        console.log(`✅ Actualización masiva completada: ${updateResult[0].affectedRows} productos actualizados`);

        // 4. Verificación post-corrección
        console.log('\n📊 4. Verificando resultados...');
        
        const [statusAfter] = await connection.execute(`
            SELECT 
                is_active,
                COUNT(*) as count,
                CASE WHEN is_active = 1 THEN 'ACTIVOS' ELSE 'INACTIVOS' END as estado
            FROM products 
            GROUP BY is_active
            ORDER BY is_active DESC
        `);
        
        console.log('📈 Estado actual de productos:');
        statusAfter.forEach(row => {
            console.log(`   ${row.estado}: ${row.count} productos`);
        });

        // 5. Verificación específica de productos "INAVILITADO"
        console.log('\n🔍 5. Verificando productos "INAVILITADO" específicamente...');
        
        const [inactiveCheck] = await connection.execute(`
            SELECT 
                is_active,
                COUNT(*) as count,
                CASE WHEN is_active = 1 THEN 'ACTIVOS (INCORRECTOS)' ELSE 'INACTIVOS (CORRECTOS)' END as estado
            FROM products 
            WHERE UPPER(product_name) LIKE '%INAVILITADO%' 
               OR UPPER(product_name) LIKE '%INACTIVO%' 
               OR UPPER(product_name) LIKE '%DESCONTINUADO%'
               OR UPPER(product_name) LIKE '%ELIMINADO%'
               OR UPPER(product_name) LIKE '%DESHABILITADO%'
            GROUP BY is_active
            ORDER BY is_active DESC
        `);
        
        console.log('📊 Estado de productos "INAVILITADO":');
        inactiveCheck.forEach(row => {
            console.log(`   ${row.estado}: ${row.count} productos`);
        });

        // 6. Mostrar algunos productos corregidos
        console.log('\n📝 6. Algunos productos corregidos:');
        
        const [sampleFixed] = await connection.execute(`
            SELECT internal_code, product_name, is_active
            FROM products 
            WHERE UPPER(product_name) LIKE '%INAVILITADO%' 
            AND is_active = 0
            ORDER BY internal_code
            LIMIT 15
        `);
        
        sampleFixed.forEach(product => {
            console.log(`   ✅ ${product.internal_code}: ${product.product_name} - INACTIVO`);
        });

        // 7. Resumen final
        console.log('\n🎉 CORRECCIÓN MASIVA COMPLETADA!');
        console.log('=====================================');
        console.log(`✅ Productos corregidos: ${updateResult[0].affectedRows}`);
        console.log(`✅ Total productos inactivos: ${inactiveCheck.find(r => r.is_active === 0)?.count || 0}`);
        
        const remainingIncorrect = inactiveCheck.find(r => r.is_active === 1)?.count || 0;
        if (remainingIncorrect > 0) {
            console.log(`⚠️  Productos aún incorrectos: ${remainingIncorrect}`);
        } else {
            console.log('🎯 ÉXITO: Todos los productos "INAVILITADO" ahora están correctamente marcados como inactivos');
        }

    } catch (error) {
        console.error('❌ Error durante la corrección masiva:', error.message);
    } finally {
        await connection.end();
    }
}

fixAllInactiveProductsMassive().catch(console.error);
