const { query } = require('../config/database');

async function runMigration() {
    console.log('🚀 Iniciando creación de tabla tags...');

    try {
        // Crear tabla tags
        await query(`
            CREATE TABLE IF NOT EXISTS tags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);
        console.log('✅ Tabla tags creada (o ya existía).');

        // Insertar tags predefinidos
        const initialTags = ['cliente jhonk', 'cliente chamos', 'cliente especial'];
        for (const tag of initialTags) {
            try {
                await query('INSERT INTO tags (name) VALUES (?)', [tag]);
                console.log(`   - Tag insertado: ${tag}`);
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') {
                    console.log(`   - Tag ya existe: ${tag}`);
                } else {
                    throw e;
                }
            }
        }

        console.log('🎉 Migración completada exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        process.exit(1);
    }
}

runMigration();
