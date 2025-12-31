const { query, poolEnd } = require('./config/database');

async function migrate() {
    try {
        console.log('Adding payment_status column...');

        // Add column with default PAGADO
        await query("ALTER TABLE expenses ADD COLUMN payment_status ENUM('PAGADO', 'PENDIENTE') NOT NULL DEFAULT 'PAGADO' AFTER source");

        console.log('Backfilling data...');
        // If source is NULL (the old way of saying "Por Pagar"), set status to PENDIENTE
        await query("UPDATE expenses SET payment_status = 'PENDIENTE' WHERE source IS NULL");

        console.log('Verifying schema...');
        const schema = await query("DESCRIBE expenses");
        console.table(schema);

        console.log('Migration successful.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists, skipping migration.');
        } else {
            console.error('Migration failed:', e);
        }
    } finally {
        await poolEnd();
        process.exit();
    }
}

migrate();
