const { pool } = require('../config/database');

async function debugLocalOrder() {
    try {
        const [rows] = await pool.query('SELECT * FROM orders WHERE order_number = ?', ['FV-2-15436']);

        if (rows.length > 0) {
            const order = rows[0];
            console.log('✅ Local Order Found:', order.id);
            console.log('Totals:', {
                total_amount: order.total_amount,
                total: order.total,
                subtotal: order.subtotal,
                tax: order.tax,
                discount: order.discount,
                net_value: order.net_value, // check if this column exists
                paid_amount: order.paid_amount
            });

            // Also fetch items to check codes
            const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
            console.log('Items:', items.map(i => ({
                code: i.code,
                product_name: i.product_name,
                quantity: i.quantity
            })));

        } else {
            console.log('❌ Order FV-2-15436 not found in local DB.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugLocalOrder();
