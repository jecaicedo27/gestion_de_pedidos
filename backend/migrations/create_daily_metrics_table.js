const { query } = require('../config/database');

async function createDailyMetricsTable() {
    try {
        console.log('Creating daily_metrics table...');
        await query(`
            CREATE TABLE IF NOT EXISTS daily_metrics (
                date DATE PRIMARY KEY,
                chats_count INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('daily_metrics table created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error creating daily_metrics table:', error);
        process.exit(1);
    }
}

createDailyMetricsTable();
