const { pool } = require('../config/database');

async function up() {
    try {
        console.log('Adding net_value column to orders table...');
        await pool.query(`
      ALTER TABLE orders
      ADD COLUMN net_value DECIMAL(15, 2) DEFAULT NULL AFTER total_amount
    `);
        console.log('✅ net_value column added successfully');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️ net_value column already exists');
        } else {
            console.error('❌ Error adding net_value column:', error);
            throw error;
        }
    }
}

up().then(() => process.exit(0)).catch(() => process.exit(1));
