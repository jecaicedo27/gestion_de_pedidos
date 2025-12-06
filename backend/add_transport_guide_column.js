const { query, poolEnd } = require('./config/database');

async function addTransportGuideColumn() {
    try {
        // Check if column exists
        const columns = await query("SHOW COLUMNS FROM orders LIKE 'transport_guide_url'");
        if (columns.length === 0) {
            console.log('Adding transport_guide_url column...');
            await query("ALTER TABLE orders ADD COLUMN transport_guide_url VARCHAR(255) DEFAULT NULL AFTER shipping_guide_path");
            console.log('✅ Column added successfully.');
        } else {
            console.log('ℹ️ Column transport_guide_url already exists.');
        }
    } catch (error) {
        console.error('❌ Error adding column:', error);
    } finally {
        await poolEnd();
    }
}

addTransportGuideColumn();
