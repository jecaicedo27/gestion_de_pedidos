const { pool } = require('../config/database');

async function debugScannedBarcodes() {
    try {
        const [rows] = await pool.query('SELECT id, scanned_barcodes, verification_notes FROM packaging_item_verifications WHERE id = 5336');
        if (rows.length > 0) {
            console.log('Verification 5336:', rows[0]);
        } else {
            console.log('Verification 5336 not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugScannedBarcodes();
