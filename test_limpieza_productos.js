const mysql = require('mysql2/promise');
const siigoService = require('./backend/services/siigoService');

async function testProductCleanup() {
    console.log('🧪 TEST DE LIMPIEZA DE PRODUCTOS (Solo análisis, no hace cambios)');
    console.log('=' * 70);

    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        // Análisis 1: Estado actual
        console.log('📊 ESTADO ACTUAL:');
        const [currentStats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_products,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_products
            FROM products
        `);
        
        console.table(currentStats);

        // Análisis 2: Productos con "INAVILITADO" que están activos
        console.log('\n⚠️  PRODUCTOS CON "INAVILITADO" QUE ESTÁN ACTIVOS:');
        const [invalidProducts] = await connection.execute(`
            SELECT internal_code, product_name, is_active, created_at
            FROM products 
            WHERE LOWER(product_name) LIKE '%inavilitado%' AND is_active = 1
            ORDER BY internal_code
        `);
        
        console.log(`Encontrados: ${invalidProducts.length} productos`);
        if (invalidProducts.length > 0) {
            console.table(invalidProducts);
        }

        // Análisis 3: Obtener muestra de productos de SIIGO
        console.log('\n🔍 ANALIZANDO PRODUCTOS DE SIIGO (primera página)...');
        const siigoProducts = await siigoService.getAllProducts(1, 20);
        console.log(`Muestra obtenida: ${siigoProducts.length} productos de SIIGO`);
        
        // Crear set de códigos de SIIGO
        const siigoProductCodes = new Set(siigoProducts.map(p => p.code));

        // Análisis 4: Productos "fantasma" potenciales
        console.log('\n👻 PRODUCTOS POTENCIALMENTE "FANTASMA":');
        const [localProducts] = await connection.execute(
            'SELECT internal_code, product_name, is_active FROM products WHERE internal_code IS NOT NULL LIMIT 50'
        );

        const phantomProducts = localProducts.filter(localProduct => 
            !siigoProductCodes.has(localProduct.internal_code)
        );

        console.log(`Productos fantasma potenciales: ${phantomProducts.length}`);
        if (phantomProducts.length > 0) {
            console.log('(Nota: Esta es solo una muestra de los primeros 50 productos)');
            phantomProducts.slice(0, 10).forEach(product => {
                console.log(`   - ${product.internal_code}: "${product.product_name}" (${product.is_active ? 'ACTIVO' : 'INACTIVO'})`);
            });
        }

        // Análisis 5: Resumen de lo que se haría
        console.log('\n🔧 RESUMEN DE CAMBIOS QUE SE REALIZARÍAN:');
        console.log(`   1. ✅ Marcar como inactivos: ${invalidProducts.length} productos con "INAVILITADO"`);
        console.log(`   2. 🧹 Identificar y limpiar productos "fantasma" (análisis completo necesario)`);
        console.log(`   3. 🔄 Reimportar todos los productos desde SIIGO con estados correctos`);
        console.log(`   4. 📊 Generar reporte final con estadísticas`);

        // Análisis 6: Muestra de productos activos correctos
        console.log('\n✅ MUESTRA DE PRODUCTOS ACTIVOS (primeros 10):');
        const [activeProducts] = await connection.execute(`
            SELECT internal_code, product_name, category, is_active
            FROM products 
            WHERE is_active = 1 AND LOWER(product_name) NOT LIKE '%inavilitado%'
            ORDER BY internal_code 
            LIMIT 10
        `);
        console.table(activeProducts);

        console.log('\n' + '=' * 70);
        console.log('✅ ANÁLISIS COMPLETADO');
        console.log('💡 Para ejecutar la limpieza real, usa: node limpiar_productos_completo.js');

    } catch (error) {
        console.error('❌ Error en el análisis:', error);
    } finally {
        await connection.end();
    }
}

testProductCleanup().catch(console.error);
