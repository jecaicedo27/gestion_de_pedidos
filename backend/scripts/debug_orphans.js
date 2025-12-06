
const { query } = require('../config/database');
require('dotenv').config({ path: '../.env' });

async function checkOrphans() {
    try {
        const orderNumber = '15436';
        const [orders] = await query('SELECT id FROM orders WHERE order_number LIKE ?', [`%${orderNumber}%`]);

        if (!orders) {
            console.log('Order not found');
            process.exit(0);
        }

        const orderId = orders.id;
        console.log(`Checking orphans for Order ID: ${orderId}`);

        // Check for verifications that point to non-existent order_items
        const orphans = await query(`
      SELECT piv.* 
      FROM packaging_item_verifications piv
      LEFT JOIN order_items oi ON piv.item_id = oi.id
      WHERE oi.id IS NULL
    `);

        console.log('Orphaned Verifications:', orphans);

        // Also check if there are any verifications for this order's items that look suspicious
        const verifications = await query(`
      SELECT piv.*, oi.product_code, oi.name
      FROM packaging_item_verifications piv
      JOIN order_items oi ON piv.item_id = oi.id
      WHERE oi.order_id = ?
    `, [orderId]);

        console.log('Verifications for this order:', verifications);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkOrphans();
