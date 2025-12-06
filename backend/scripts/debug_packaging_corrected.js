const { pool } = require('../config/database');

async function debugPackagingCorrected() {
    try {
        const [orders] = await pool.query('SELECT id FROM orders WHERE order_number = ?', ['FV-2-15436']);
        if (orders.length === 0) {
            console.log('Order not found');
            return;
        }
        const orderId = orders[0].id;

        const [verifications] = await pool.query(`
            SELECT 
                piv.id as verification_id,
                piv.item_id,
                oi.product_code as item_code,
                oi.product_name as item_name,
                piv.required_scans,
                piv.scanned_count,
                p.barcode as product_barcode,
                p.internal_code as product_internal_code
            FROM packaging_item_verifications piv
            JOIN order_items oi ON piv.item_id = oi.id
            LEFT JOIN products p ON oi.product_code = p.internal_code
            WHERE piv.order_id = ? AND oi.product_code LIKE '%CHAM%'
        `, [orderId]);

        console.log('CHAM Verifications:', verifications);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugPackagingCorrected();
