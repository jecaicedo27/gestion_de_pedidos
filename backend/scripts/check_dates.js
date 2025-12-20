const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkDates = async () => {
    try {
        const [rows] = await pool.query(`
            SELECT DATE(analysis_date) as day, COUNT(*) as records 
            FROM inventory_analysis_history 
            GROUP BY DATE(analysis_date) 
            ORDER BY day DESC
        `);
        console.table(rows);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkDates();
