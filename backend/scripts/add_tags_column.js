const { query } = require('../config/database');

async function runMigration() {
    console.log('🚀 Iniciando migración de columna tags...');

    try {
        // Agregar columna tags (JSON)
        try {
            await query(`
        ALTER TABLE orders 
        ADD COLUMN tags JSON NULL DEFAULT NULL AFTER siigo_closure_note
      `);
            console.log('✅ Columna tags agregada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ La columna tags ya existe.');
            } else {
                throw e;
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
