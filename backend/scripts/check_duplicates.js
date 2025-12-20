const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkDuplicates = async () => {
    try {
        const query = `
            SELECT product_name, COUNT(*) as count 
            FROM products 
            GROUP BY product_name 
            HAVING count > 1
        `;
        const [rows] = await pool.query(query);

        console.log('--- Duplicate Products Check ---');
        if (rows.length > 0) {
            console.log(`Found ${rows.length} product names with duplicates:`);
            rows.forEach(r => console.log(`- "${r.product_name}": ${r.count} times`));
        } else {
            console.log('No duplicate product names found.');
        }

        const [total] = await pool.query('SELECT COUNT(*) as c FROM products');
        console.log(`Total rows in products: ${total[0].c}`);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkDuplicates();
