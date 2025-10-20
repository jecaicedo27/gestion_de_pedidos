const { pool } = require('./backend/config/database');

async function clearProductsTable() {
    try {
        console.log('🧹 Limpiando tabla de productos...');
        
        // Borrar todos los productos y variantes
        await pool.execute('DELETE FROM product_variants');
        await pool.execute('DELETE FROM product_barcodes');
        
        // Resetear auto_increment
        await pool.execute('ALTER TABLE product_barcodes AUTO_INCREMENT = 1');
        await pool.execute('ALTER TABLE product_variants AUTO_INCREMENT = 1');
        
        console.log('✅ Tabla de productos limpiada exitosamente');
        
    } catch (error) {
        console.error('❌ Error limpiando tabla de productos:', error);
    } finally {
        process.exit(0);
    }
}

clearProductsTable();
