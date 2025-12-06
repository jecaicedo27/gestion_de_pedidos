const { pool } = require('../config/database');

async function debugSimpleScans() {
    try {
        const [orders] = await pool.query('SELECT id FROM orders WHERE order_number = ?', ['FV-2-15436']);
        if (orders.length === 0) {
            console.log('Order not found');
            return;
        }
        const orderId = orders[0].id;

        const [scans] = await pool.query('SELECT * FROM simple_barcode_scans WHERE order_id = ?', [orderId]);
        console.log('Simple Scans:', scans);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugSimpleScans();
