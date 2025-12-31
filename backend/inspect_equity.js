
const { query } = require('./config/database');

(async () => {
    try {
        const rows = await query(`
            SELECT id, date, date_str, notes, created_at, updated_at 
            FROM equity_history 
            ORDER BY date DESC 
            LIMIT 5
        `);
        console.log('Recent Equity History:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
