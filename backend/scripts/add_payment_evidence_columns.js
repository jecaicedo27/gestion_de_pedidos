const { query } = require('../config/database');

async function runMigration() {
    console.log('🚀 Iniciando migración de columnas de evidencia de pago...');

    try {
        // 1. Agregar columna payment_evidence_path
        try {
            await query(`
        ALTER TABLE orders 
        ADD COLUMN payment_evidence_path VARCHAR(255) NULL DEFAULT NULL AFTER payment_method
      `);
            console.log('✅ Columna payment_evidence_path agregada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ La columna payment_evidence_path ya existe.');
            } else {
                throw e;
            }
        }

        // 2. Agregar columna is_pending_payment_evidence
        try {
            await query(`
        ALTER TABLE orders 
        ADD COLUMN is_pending_payment_evidence BOOLEAN DEFAULT FALSE AFTER payment_evidence_path
      `);
            console.log('✅ Columna is_pending_payment_evidence agregada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ La columna is_pending_payment_evidence ya existe.');
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
