const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkMatch = async () => {
    try {
        const [items] = await pool.query('SELECT product_name, product_code FROM order_items WHERE product_code IS NOT NULL LIMIT 5');
        console.log('Order Items:', items);

        const [products] = await pool.query('SELECT product_name, barcode, internal_code FROM products LIMIT 5');
        console.log('Products:', products);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkMatch();
