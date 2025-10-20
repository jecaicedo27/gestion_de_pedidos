const { pool } = require('../backend/config/database');

async function createCategoriesTable() {
    try {
        console.log('📋 Creando tabla de categorías...');

        // Crear tabla categories
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                siigo_id VARCHAR(255) UNIQUE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                parent_category_id INT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_siigo_id (siigo_id),
                INDEX idx_name (name),
                INDEX idx_active (is_active),
                FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Tabla categories creada exitosamente');

        // Migrar categorías existentes de la tabla products
        console.log('📋 Migrando categorías existentes...');
        
        const [existingCategories] = await pool.execute(`
            SELECT DISTINCT category 
            FROM products 
            WHERE category IS NOT NULL 
            AND category != '' 
            AND category != 'Sin categoría'
        `);

        let migratedCount = 0;
        for (const cat of existingCategories) {
            try {
                await pool.execute(`
                    INSERT IGNORE INTO categories (name, description)
                    VALUES (?, ?)
                `, [cat.category, `Categoría migrada desde productos existentes`]);
                migratedCount++;
            } catch (error) {
                console.warn(`⚠️ Error migrando categoría ${cat.category}:`, error.message);
            }
        }

        console.log(`✅ ${migratedCount} categorías migradas exitosamente`);

        // Crear tabla de logs de sincronización de categorías
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS category_sync_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                categories_synced INT DEFAULT 0,
                categories_created INT DEFAULT 0,
                categories_updated INT DEFAULT 0,
                categories_deactivated INT DEFAULT 0,
                errors INT DEFAULT 0,
                sync_duration_ms INT DEFAULT 0,
                error_details TEXT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Tabla category_sync_logs creada exitosamente');
        console.log('🎉 Sistema de categorías dinámicas configurado correctamente');

    } catch (error) {
        console.error('❌ Error creando tabla de categorías:', error);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    createCategoriesTable()
        .then(() => {
            console.log('🎉 Migración completada');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error en migración:', error);
            process.exit(1);
        });
}

module.exports = { createCategoriesTable };
