const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkSchema = async () => {
    try {
        const [rows] = await pool.query('DESCRIBE inventory_analysis_history');
        console.table(rows);

        // Also peek at data
        const [data] = await pool.query('SELECT * FROM inventory_analysis_history ORDER BY analysis_date DESC LIMIT 5');
        console.log('Latest Data:', data);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkSchema();
