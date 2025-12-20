const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkNames = async () => {
    try {
        const query = `
            SELECT product_name FROM products 
            WHERE product_name LIKE '%PERLA%' 
            LIMIT 10
        `;
        const [rows] = await pool.query(query);
        console.log('--- Perlas Samples ---');
        rows.forEach(r => console.log(r.product_name));

        const [rows2] = await pool.query(`SELECT product_name FROM products WHERE product_name LIKE '%GENIALITY%' LIMIT 10`);
        console.log('--- Geniality Samples ---');
        rows2.forEach(r => console.log(r.product_name));

        const [rows3] = await pool.query(`SELECT product_name FROM products WHERE product_name LIKE '%BANDERITA%' OR product_name LIKE '%FRUTOS SECOS%' LIMIT 10`);
        console.log('--- Banderitas/Frutos Samples ---');
        rows3.forEach(r => console.log(r.product_name));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkNames();
