
const { query } = require('../config/database');
require('dotenv').config({ path: '../.env' });

async function checkOrderItems() {
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
      SELECT 
        oi.id, 
        oi.product_code, 
        oi.name, 
        oi.quantity, 
        oi.status, 
        piv.scanned_count, 
        piv.is_verified 
      FROM order_items oi 
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id 
      WHERE oi.order_id = ?
    `, [orderId]);

        console.table(items);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkOrderItems();
