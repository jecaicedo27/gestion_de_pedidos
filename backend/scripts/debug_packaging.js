const { pool } = require('../config/database');

async function debugPackaging() {
    try {
        const [orders] = await pool.query('SELECT id FROM orders WHERE order_number = ?', ['FV-2-15436']);
        if (orders.length === 0) {
            console.log('Order not found');
            return;
        }
        const orderId = orders[0].id;

        const [verifications] = await pool.query(`
            SELECT 
                piv.id,
                piv.product_code,
                piv.quantity_required,
                piv.quantity_scanned,
                piv.scanned_barcodes,
                p.barcode as product_barcode
            FROM packaging_item_verifications piv
            LEFT JOIN products p ON piv.product_code = p.internal_code
            WHERE piv.order_id = ?
        `, [orderId]);

        console.log('Packaging Verifications:', verifications);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugPackaging();
