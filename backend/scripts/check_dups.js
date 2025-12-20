const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkOrder = async () => {
    try {
        const orderNums = ['FV-2-15449', 'FV-2-15341'];
        const [rows] = await pool.query(`
            SELECT id, order_number, status, total_amount, tags, created_at 
            FROM orders 
            WHERE order_number IN (?)
        `, [orderNums]);
        console.table(rows);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkOrder();
