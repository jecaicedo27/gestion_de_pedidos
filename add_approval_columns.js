const { pool } = require('./backend/config/database');

async function run() {
    try {
        console.log('Adding approved_by and approved_at columns to orders table...');

        // Check if columns exist first to avoid errors
        const [columns] = await pool.execute('SHOW COLUMNS FROM orders LIKE "approved_by"');
        if (columns.length === 0) {
            await pool.execute('ALTER TABLE orders ADD COLUMN approved_by INT NULL AFTER validation_notes');
            console.log('Added approved_by column.');
        } else {
            console.log('approved_by column already exists.');
        }

        const [columnsAt] = await pool.execute('SHOW COLUMNS FROM orders LIKE "approved_at"');
        if (columnsAt.length === 0) {
            await pool.execute('ALTER TABLE orders ADD COLUMN approved_at DATETIME NULL AFTER approved_by');
            console.log('Added approved_at column.');
        } else {
            console.log('approved_at column already exists.');
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

run();
