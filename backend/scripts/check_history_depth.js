const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkData = async () => {
    try {
        const [minDate] = await pool.query('SELECT MIN(analysis_date) as min_date FROM inventory_analysis_history');
        console.log('Min Analysis Date:', minDate[0].min_date);

        const [tables] = await pool.query("SHOW TABLES LIKE '%stock%'");
        console.log('Stock Related Tables:', tables);

        const [tables2] = await pool.query("SHOW TABLES LIKE '%inventory%'");
        console.log('Inventory Related Tables:', tables2);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkData();
