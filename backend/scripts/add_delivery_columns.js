const { pool } = require('../config/database');

async function addDeliveryColumns() {
    try {
        console.log('📋 Agregando columnas de entrega a la tabla orders...');

        // Check if columns already exist
        const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME IN ('delivered_by', 'submitted_for_approval_at')
    `);

        const existingColumns = columns.map(c => c.COLUMN_NAME);
        console.log('Columnas existentes:', existingColumns);

        // Add missing columns
        const columnsToAdd = [
            {
                name: 'delivered_by',
                sql: 'delivered_by INT NULL COMMENT "ID del usuario que marcó como entregado"',
                fk: 'ADD CONSTRAINT fk_delivered_by FOREIGN KEY (delivered_by) REFERENCES users(id) ON DELETE SET NULL'
            },
            {
                name: 'submitted_for_approval_at',
                sql: 'submitted_for_approval_at TIMESTAMP NULL COMMENT "Fecha de envío a aprobación de cartera"'
            }
        ];

        for (const col of columnsToAdd) {
            if (!existingColumns.includes(col.name)) {
                console.log(`➕ Agregando columna: ${col.name}`);
                await pool.execute(`ALTER TABLE orders ADD COLUMN ${col.sql}`);
                console.log(`✅ Columna ${col.name} agregada exitosamente`);

                // Add foreign key if specified
                if (col.fk) {
                    try {
                        console.log(`🔗 Agregando clave foránea para ${col.name}...`);
                        await pool.execute(`ALTER TABLE orders ${col.fk}`);
                        console.log(`✅ Clave foránea agregada`);
                    } catch (fkError) {
                        console.warn(`⚠️ No se pudo agregar clave foránea (puede que ya exista):`, fkError.message);
                    }
                }
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

addDeliveryColumns();
