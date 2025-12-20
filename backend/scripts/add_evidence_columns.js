const { pool } = require('../config/database');

async function addEvidenceColumns() {
    try {
        console.log('📋 Agregando columnas de evidencia a la tabla orders...');

        // Check if columns already exist
        const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME IN ('product_evidence_photo', 'payment_evidence_photo', 'cash_evidence_photo')
    `);

        const existingColumns = columns.map(c => c.COLUMN_NAME);
        console.log('Columnas existentes:', existingColumns);

        // Add missing columns
        const columnsToAdd = [
            { name: 'product_evidence_photo', sql: 'product_evidence_photo VARCHAR(255) NULL COMMENT "Foto del producto entregado (POS)"' },
            { name: 'payment_evidence_photo', sql: 'payment_evidence_photo VARCHAR(255) NULL COMMENT "Comprobante de pago (POS)"' },
            { name: 'cash_evidence_photo', sql: 'cash_evidence_photo VARCHAR(255) NULL COMMENT "Foto del efectivo recibido (POS)"' }
        ];

        for (const col of columnsToAdd) {
            if (!existingColumns.includes(col.name)) {
                console.log(`➕ Agregando columna: ${col.name}`);
                await pool.execute(`ALTER TABLE orders ADD COLUMN ${col.sql}`);
                console.log(`✅ Columna ${col.name} agregada exitosamente`);
            } else {
                console.log(`⏭️ Columna ${col.name} ya existe`);
            }
        }

        console.log('✅ Migración completada exitosamente');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

addEvidenceColumns();
