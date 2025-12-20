const { query, poolEnd } = require('../config/database');

async function addSaleChannelColumn() {
    try {
        // Check if column exists
        const columns = await query("SHOW COLUMNS FROM orders LIKE 'sale_channel'");

        if (columns.length === 0) {
            console.log('Adding sale_channel column...');
            await query("ALTER TABLE orders ADD COLUMN sale_channel VARCHAR(50) DEFAULT NULL AFTER delivery_method");
            console.log('✅ sale_channel column added successfully.');
        } else {
            console.log('ℹ️ sale_channel column already exists.');
        }

    } catch (error) {
        console.error('❌ Error adding column:', error);
    } finally {
        await poolEnd();
    }
}

addSaleChannelColumn();
