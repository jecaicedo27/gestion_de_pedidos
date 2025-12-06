const { pool } = require('../config/database');

async function debugOrderItems() {
    try {
        const [orders] = await pool.query('SELECT id FROM orders WHERE order_number = ?', ['FV-2-15436']);
        if (orders.length === 0) {
            console.log('Order not found');
            return;
        }
        const orderId = orders[0].id;

        const [items] = await pool.query(`
            SELECT 
                oi.id, 
                oi.product_code as item_code, 
                oi.quantity, 
                oi.product_name,
                p.internal_code as product_internal_code,
                p.barcode as product_barcode
            FROM order_items oi
            LEFT JOIN products p ON oi.product_code = p.internal_code
            WHERE oi.order_id = ? AND (oi.product_code LIKE '%CHAM%' OR p.barcode LIKE '%TEMP%')
        `, [orderId]);

        console.log('CHAM Items:', items);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugOrderItems();
