const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function clearFakeStockData() {
    console.log('🧹 LIMPIANDO DATOS DE STOCK FICTICIOS');
    console.log('====================================');
    
    try {
        const connection = await mysql.createConnection(config);
        
        console.log('1️⃣ Verificando datos de stock actuales...');
        const [currentStock] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN stock > 0 THEN 1 END) as with_stock,
                COUNT(CASE WHEN available_quantity > 0 THEN 1 END) as with_available,
                MAX(stock) as max_stock,
                MAX(available_quantity) as max_available
            FROM products
        `);
        
        console.log('📊 Estado actual:');
        console.log(`   Total productos: ${currentStock[0].total_products}`);
        console.log(`   Con stock > 0: ${currentStock[0].with_stock}`);
        console.log(`   Con disponible > 0: ${currentStock[0].with_available}`);
        console.log(`   Stock máximo: ${currentStock[0].max_stock}`);
        console.log(`   Disponible máximo: ${currentStock[0].max_available}`);
        
        console.log('\n2️⃣ Limpiando datos de stock ficticios...');
        
        // Resetear todos los campos de stock a NULL para que muestren datos reales de SIIGO
        const [result] = await connection.execute(`
            UPDATE products 
            SET 
                stock = NULL,
                available_quantity = NULL
            WHERE 1=1
        `);
        
        console.log(`✅ ${result.affectedRows} productos actualizados - stock limpiado`);
        
        console.log('\n3️⃣ Verificando limpieza...');
        const [afterClean] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN stock > 0 THEN 1 END) as with_stock,
                COUNT(CASE WHEN available_quantity > 0 THEN 1 END) as with_available,
                COUNT(CASE WHEN stock IS NULL THEN 1 END) as stock_null,
                COUNT(CASE WHEN available_quantity IS NULL THEN 1 END) as available_null
            FROM products
        `);
        
        console.log('📊 Estado después de limpieza:');
        console.log(`   Total productos: ${afterClean[0].total_products}`);
        console.log(`   Con stock > 0: ${afterClean[0].with_stock}`);
        console.log(`   Con disponible > 0: ${afterClean[0].with_available}`);
        console.log(`   Stock NULL: ${afterClean[0].stock_null}`);
        console.log(`   Disponible NULL: ${afterClean[0].available_null}`);
        
        await connection.end();
        
        console.log('\n✅ LIMPIEZA COMPLETADA');
        console.log('💡 Ahora el sistema mostrará "No disponible" hasta que se sincronicen los datos reales de SIIGO');
        console.log('🔄 Usa el botón "Cargar Productos" en el frontend para sincronizar datos reales desde SIIGO');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

clearFakeStockData();
