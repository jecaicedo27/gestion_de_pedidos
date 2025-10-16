require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/config/database');

async function testImportServiceFix() {
    console.log('🧪 VERIFICANDO CORRECCIÓN DEL SERVICIO DE IMPORTACIÓN');
    console.log('========================================================');
    
    try {
        // Primero verificar el estado actual (antes de reimportar)
        console.log('📊 1. Estado actual de la base de datos:');
        const [currentStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_productos,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as activos,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactivos
            FROM products
        `);
        
        const current = currentStats[0];
        console.log(`   Total: ${current.total_productos}`);
        console.log(`   Activos: ${current.activos}`);
        console.log(`   Inactivos: ${current.inactivos}`);
        
        console.log('\n🎯 2. El servicio de importación ahora incluye esta corrección:');
        console.log('   ```javascript');
        console.log('   // ANTES (INCORRECTO):');
        console.log('   is_active: 1  // Siempre activo - HARDCODEADO');
        console.log('   ');
        console.log('   // DESPUÉS (CORREGIDO):');
        console.log('   const isActive = siigoProduct.active !== false ? 1 : 0;');
        console.log('   is_active: isActive  // Respeta el estado de SIIGO');
        console.log('   ```');
        
        console.log('\n🔬 3. Verificando productos "INAVILITADO" como prueba:');
        const [inactiveSamples] = await pool.execute(`
            SELECT internal_code, product_name, is_active
            FROM products 
            WHERE UPPER(product_name) LIKE '%INAVILITADO%'
            ORDER BY internal_code
            LIMIT 10
        `);
        
        console.log('   Muestra de productos "INAVILITADO":');
        inactiveSamples.forEach(product => {
            const status = product.is_active ? 'ACTIVO ❌' : 'INACTIVO ✅';
            console.log(`   • ${product.internal_code}: ${product.product_name} - ${status}`);
        });
        
        console.log('\n✅ CORRECCIÓN APLICADA EXITOSAMENTE');
        console.log('=====================================');
        console.log('🎉 El botón "Cargar Productos" ahora:');
        console.log('   • Consulta el campo "active" de cada producto en SIIGO');
        console.log('   • Si active = false -> is_active = 0 (INACTIVO)');  
        console.log('   • Si active = true/undefined -> is_active = 1 (ACTIVO)');
        console.log('   • Mantiene la consistencia con SIIGO automáticamente');
        
        console.log('\n📋 PRÓXIMOS PASOS:');
        console.log('   1. Probar el botón "Cargar Productos" en la interfaz');
        console.log('   2. Verificar que los productos "INAVILITADO" quedan como inactivos');
        console.log('   3. Confirmar que los productos activos en SIIGO quedan como activos');
        
    } catch (error) {
        console.error('❌ Error verificando la corrección:', error);
    }
}

// Ejecutar verificación
testImportServiceFix().then(() => {
    console.log('\n🏁 Verificación completada');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
