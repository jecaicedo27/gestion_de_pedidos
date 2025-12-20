const { query } = require('./backend/config/database');
require('dotenv').config({ path: './backend/.env' });

async function runMigration() {
    try {
        console.log('Iniciando migración...');

        // Verificar si la columna ya existe
        const columns = await query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_inventory_config' AND COLUMN_NAME = 'supplier'
        `, [process.env.DB_NAME || 'gestion_pedidos']);

        if (columns.length === 0) {
            console.log('Agregando columna supplier...');
            await query(`
                ALTER TABLE product_inventory_config
                ADD COLUMN supplier VARCHAR(255) NULL AFTER pack_size
            `);
            console.log('✅ Columna supplier agregada exitosamente.');
        } else {
            console.log('ℹ️ La columna supplier ya existe.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

runMigration();
