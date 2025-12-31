const { query } = require('../config/database');

async function updateDailyMetricsTable() {
    try {
        console.log('Updating daily_metrics table...');

        // Check if columns exist to avoid errors on multiple runs
        const checkColumns = await query(`SHOW COLUMNS FROM daily_metrics LIKE 'chats_start'`);

        if (checkColumns.length === 0) {
            await query(`
                ALTER TABLE daily_metrics
                ADD COLUMN chats_start INT DEFAULT 0,
                ADD COLUMN chats_end INT DEFAULT 0,
                ADD COLUMN orders_manual_count INT DEFAULT 0;
            `);
            console.log('Columns added successfully.');
        } else {
            console.log('Columns already exist.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error updating daily_metrics table:', error);
        process.exit(1);
    }
}

updateDailyMetricsTable();
