const { query } = require('../config/database');

async function createTable() {
    try {
        console.log('Creating siigo_income_daily table...');
        await query(`
      CREATE TABLE IF NOT EXISTS siigo_income_daily (
        date DATE PRIMARY KEY,
        total_amount DECIMAL(15, 2) DEFAULT 0,
        details_json JSON,
        last_updated DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Table siigo_income_daily created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating table:', error);
        process.exit(1);
    }
}

createTable();
