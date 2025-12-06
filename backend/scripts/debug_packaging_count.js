const { pool } = require('../config/database');

async function debugPackagingCount() {
    try {
        const [orders] = await pool.query('SELECT id FROM orders WHERE order_number = ?', ['FV-2-15436']);
        if (orders.length === 0) {
            console.log('Order not found');
            return;
        }
        const orderId = orders[0].id;

        const [count] = await pool.query('SELECT COUNT(*) as count FROM packaging_item_verifications WHERE order_id = ?', [orderId]);
        console.log('Total Verifications:', count[0].count);

        const [allVerifications] = await pool.query('SELECT id, item_id FROM packaging_item_verifications WHERE order_id = ?', [orderId]);
        console.log('All Verification IDs:', allVerifications);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugPackagingCount();
