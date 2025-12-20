require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('🔄 Iniciando migración para reposición de fabricante...');

        // 1. Agregar columnas a la tabla orders
        console.log('📝 Agregando columnas a tabla orders...');
        await connection.execute(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS manufacturer_reposition_completed TINYINT(1) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS manufacturer_reposition_completed_at DATETIME NULL,
      ADD COLUMN IF NOT EXISTS manufacturer_reposition_completed_by INT NULL,
      ADD COLUMN IF NOT EXISTS manufacturer_reposition_notes TEXT NULL
    `);
        console.log('✅ Columnas agregadas a orders');

        // 2. Crear tabla de evidencias
        console.log('📝 Creando tabla manufacturer_reposition_evidences...');
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS manufacturer_reposition_evidences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        uploaded_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_order_id (order_id)
      )
    `);
        console.log('✅ Tabla manufacturer_reposition_evidences creada');

        console.log('✅ Migración completada exitosamente');
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
