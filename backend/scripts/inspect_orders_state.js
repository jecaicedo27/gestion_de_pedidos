const { query } = require('../config/database');

async function inspectOrders() {
    try {
        const orderNumbers = ['FV-2-15296', 'FV-1-86'];

        for (const num of orderNumbers) {
            console.log(`\n--- Inspecting Order ${num} ---`);

            // 1. Check Orders table
            const orders = await query('SELECT id, order_number, payment_method, status, is_pending_payment_evidence, total_amount FROM orders WHERE order_number = ?', [num]);
            if (orders.length === 0) {
                console.log('Order not found in orders table');
                continue;
            }
            const order = orders[0];
            console.log('Order:', order);

            // 2. Check Delivery Tracking
            const tracking = await query('SELECT * FROM delivery_tracking WHERE order_id = ? ORDER BY id DESC', [order.id]);
            console.log('Delivery Tracking:', tracking);

            // 3. Check Cash Closing Details (if any)
            const closingDetails = await query('SELECT * FROM cash_closing_details WHERE order_id = ?', [order.id]);
            console.log('Cash Closing Details:', closingDetails);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspectOrders();
