const { query } = require('../config/database');

async function migrate() {
    try {
        console.log('Starting migration for Real Profitability...');

        // 1. Add purchasing_price to products
        console.log('Adding purchasing_price to products...');
        try {
            await query(`ALTER TABLE products ADD COLUMN purchasing_price DECIMAL(10,2) DEFAULT 0 AFTER standard_price`);
            console.log('Column purchasing_price added to products.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column purchasing_price already exists in products.');
            } else {
                throw e;
            }
        }

        // 2. Add purchase_cost to order_items
        console.log('Adding purchase_cost to order_items...');
        try {
            await query(`ALTER TABLE order_items ADD COLUMN purchase_cost DECIMAL(10,2) DEFAULT NULL AFTER price`);
            console.log('Column purchase_cost added to order_items.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column purchase_cost already exists in order_items.');
            } else {
                throw e;
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
