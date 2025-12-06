
const { query } = require('../config/database');
require('dotenv').config({ path: '../.env' });

async function checkSpecificItem() {
    try {
        const orderNumber = '15436';
        const [orders] = await query('SELECT id FROM orders WHERE order_number LIKE ?', [`%${orderNumber}%`]);

        if (!orders) {
            console.log('Order not found');
            process.exit(0);
        }

        const orderId = orders.id;
        console.log(`Checking items for Order ID: ${orderId}`);

        const items = await query(`
      SELECT *
      FROM order_items 
      WHERE order_id = ? 
      AND (
        product_code LIKE '%TEMP-DUP%' 
        OR name LIKE '%TEMP-DUP%' 
        OR description LIKE '%TEMP-DUP%'
      )
    `, [orderId]);

        console.log('Duplicate Items found:', items);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSpecificItem();
