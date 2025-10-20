const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function verifyImportResults() {
    let connection;
    
    try {
        console.log('🔍 Verificando resultados de la importación...\n');
        
        // Database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos'
        });
        
        console.log('✅ Conectado a la base de datos');
        
        // Check total products count
        const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM products');
        const totalProducts = countResult[0].total;
        console.log(`📦 Total productos en base de datos: ${totalProducts}`);
        
        // Check active vs inactive products
        const [activeResult] = await connection.execute('SELECT COUNT(*) as active FROM products WHERE is_active = 1');
        const [inactiveResult] = await connection.execute('SELECT COUNT(*) as inactive FROM products WHERE is_active = 0');
        
        const activeCount = activeResult[0].active;
        const inactiveCount = inactiveResult[0].inactive;
        
        console.log(`✅ Productos activos: ${activeCount}`);
        console.log(`❌ Productos inactivos: ${inactiveCount}`);
        
        // Check for the specific MP170 product that was mentioned as problematic
        const [mp170Result] = await connection.execute(
            'SELECT internal_code, product_name, is_active FROM products WHERE internal_code LIKE "%MP170%" OR product_name LIKE "%MP170%" OR product_name LIKE "%INAVALIDADO%"'
        );
        
        if (mp170Result.length > 0) {
            console.log('\n🔍 Productos MP170/INAVALIDADO encontrados:');
            mp170Result.forEach(product => {
                const status = product.is_active ? '✅ Activo' : '❌ Inactivo';
                console.log(`   - ${product.internal_code}: ${product.product_name} - ${status}`);
            });
        } else {
            console.log('\n⚠️  No se encontraron productos MP170 o INAVALIDADO');
        }
        
        // Show some sample inactive products to verify they exist
        const [sampleInactive] = await connection.execute(
            'SELECT internal_code, product_name FROM products WHERE is_active = 0 LIMIT 5'
        );
        
        if (sampleInactive.length > 0) {
            console.log('\n📋 Muestra de productos inactivos:');
            sampleInactive.forEach(product => {
                console.log(`   - ${product.internal_code}: ${product.product_name}`);
            });
        }
        
        // Check if backup table exists
        const [backupCheck] = await connection.execute(
            "SHOW TABLES LIKE 'products_backup_%'"
        );
        
        if (backupCheck.length > 0) {
            console.log('\n💾 Tablas de respaldo encontradas:');
            backupCheck.forEach(table => {
                console.log(`   - ${Object.values(table)[0]}`);
            });
        }
        
        // Summary
        console.log('\n📊 RESUMEN DE VERIFICACIÓN:');
        console.log(`   Total productos: ${totalProducts}`);
        console.log(`   Productos activos: ${activeCount} (${((activeCount/totalProducts)*100).toFixed(1)}%)`);
        console.log(`   Productos inactivos: ${inactiveCount} (${((inactiveCount/totalProducts)*100).toFixed(1)}%)`);
        
        if (totalProducts === 589) {
            console.log('✅ IMPORTACIÓN COMPLETA - Se importaron todos los 589 productos de SIIGO');
        } else if (totalProducts > 500) {
            console.log(`⚠️  IMPORTACIÓN PARCIAL - Se importaron ${totalProducts} de 589 productos esperados`);
        } else {
            console.log('❌ IMPORTACIÓN INCOMPLETA - Faltan muchos productos');
        }
        
        if (inactiveCount > 0) {
            console.log('✅ ESTADO INACTIVO DETECTADO - Existen productos inactivos en la base de datos');
            console.log('   Esto indica que la sincronización de estado activo/inactivo está funcionando');
        } else {
            console.log('⚠️  POSIBLE PROBLEMA - No se detectaron productos inactivos');
            console.log('   Verificar si todos los productos de SIIGO están realmente activos');
        }
        
    } catch (error) {
        console.error('❌ Error al verificar la importación:', error.message);
        
        if (error.code === 'ER_NO_SUCH_TABLE') {
            console.log('❌ La tabla products no existe. Ejecutar migración de base de datos primero.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('❌ Error de acceso a la base de datos. Verificar credenciales.');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('❌ No se puede conectar a la base de datos. Verificar que MySQL esté ejecutándose.');
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Execute verification
verifyImportResults();
