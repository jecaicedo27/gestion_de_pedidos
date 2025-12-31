const { query } = require('../config/database');

async function up() {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS siigo_expenses_daily (
        date DATE PRIMARY KEY,
        total_amount DECIMAL(15,2) DEFAULT 0,
        details_json LONGTEXT, 
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
        await query(createTableQuery);
        console.log('✅ Created table: siigo_expenses_daily');
    } catch (error) {
        console.error('❌ Error creating table:', error);
    }
}

up();
