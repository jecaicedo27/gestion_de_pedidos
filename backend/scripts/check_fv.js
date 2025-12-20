const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkOrder = async () => {
    try {
        const orderNum = 'FV-2-15449';
        const [rows] = await pool.query(`
            SELECT id, order_number, status, total_amount, tags, notes 
            FROM orders 
            WHERE order_number = ?
        `, [orderNum]);
        console.table(rows);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkOrder();
