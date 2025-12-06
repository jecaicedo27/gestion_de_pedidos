const { pool } = require('../config/database');

async function debugSchema() {
    try {
        const [orders] = await pool.query('SELECT * FROM orders WHERE order_number = ?', ['FV-2-15436']);
        if (orders.length > 0) {
            console.log('Order Columns:', Object.keys(orders[0]));
            console.log('Order Data:', orders[0]);
        }

        const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ? LIMIT 1', [orders[0]?.id]);
        if (items.length > 0) {
            console.log('Item Columns:', Object.keys(items[0]));
            console.log('Item Data:', items[0]);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugSchema();
