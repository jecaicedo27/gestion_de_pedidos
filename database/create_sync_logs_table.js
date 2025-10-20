const { pool } = require('../backend/config/database');

async function createSyncLogsTable() {
    try {
        console.log('🔄 Creando tabla sync_logs...');
        
        // Crear tabla para logs de sincronización
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS sync_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                siigo_product_id VARCHAR(255),
                sync_status ENUM('updated', 'error', 'completed', 'failed') NOT NULL,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_siigo_product_id (siigo_product_id),
                INDEX idx_sync_status (sync_status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        console.log('✅ Tabla sync_logs creada exitosamente');
        
        // Crear índices adicionales para optimizar consultas
        await pool.execute(`
            CREATE INDEX IF NOT EXISTS idx_status_date ON sync_logs (sync_status, created_at DESC)
        `);
        
        console.log('✅ Índices de optimización creados');
        
    } catch (error) {
        console.error('❌ Error creando tabla sync_logs:', error);
    } finally {
        process.exit(0);
    }
}

createSyncLogsTable();
