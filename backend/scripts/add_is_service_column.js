const { query } = require('../config/database');

async function run() {
    try {
        console.log('Adding is_service column to orders table...');

        // Check if column exists
        const check = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'is_service'
    `);

        if (check[0].count > 0) {
            console.log('Column is_service already exists.');
        } else {
            await query(`
        ALTER TABLE orders 
        ADD COLUMN is_service BOOLEAN DEFAULT 0 AFTER payment_evidence_path
      `);
            console.log('Column is_service added successfully.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error adding column:', error);
        process.exit(1);
    }
}

run();
