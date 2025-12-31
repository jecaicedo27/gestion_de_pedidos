
const { query } = require('./config/database');

(async () => {
    try {
        const rows = await query(`
            SELECT date, notes, created_at, updated_at 
            FROM daily_financial_snapshots 
            ORDER BY date DESC 
            LIMIT 5
        `);
        console.log('Recent Snapshots:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
