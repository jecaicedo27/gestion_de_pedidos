require('dotenv').config();
const mysql = require('mysql2/promise');

async function createTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('🔄 Creando tablas para gestión de inventario...');

        // Tabla de configuración de inventario por producto
        console.log('📝 Creando tabla product_inventory_config...');
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_inventory_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL UNIQUE,
        min_inventory_qty INT NOT NULL DEFAULT 0,
        pack_size INT NOT NULL DEFAULT 1,
        suggested_order_qty INT NULL,
        last_analysis_date DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id)
      )
    `);
        console.log('✅ Tabla product_inventory_config creada');

        // Tabla de historial de análisis
        console.log('📝 Creando tabla inventory_analysis_history...');
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_analysis_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        avg_daily_consumption DECIMAL(10,2) DEFAULT 0,
        consumption_trend VARCHAR(20) DEFAULT 'stable',
        suggested_qty INT DEFAULT 0,
        current_stock INT DEFAULT 0,
        days_until_stockout INT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_date (product_id, analysis_date)
      )
    `);
        console.log('✅ Tabla inventory_analysis_history creada');

        console.log('✅ Migración completada exitosamente');
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

createTables().catch(err => {
    console.error(err);
    process.exit(1);
});
