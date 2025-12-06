const { pool } = require('../config/database');

async function debugPackagingSchema() {
    try {
        const [rows] = await pool.query('SELECT * FROM packaging_item_verifications LIMIT 1');
        if (rows.length > 0) {
            console.log('Columns:', Object.keys(rows[0]));
            console.log('Sample Row:', rows[0]);
        } else {
            console.log('Table is empty');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugPackagingSchema();
