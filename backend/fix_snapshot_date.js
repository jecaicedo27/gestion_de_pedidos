
const { query } = require('./config/database');

(async () => {
    try {
        console.log('Fixing snapshot date...');

        // Check if there is already a record for the target date to avoid UNIQUE constraint violation if any
        const existing = await query("SELECT * FROM daily_financial_snapshots WHERE date = '2025-12-29'");
        if (existing.length > 0) {
            console.log('WARNING: A record for 2025-12-29 already exists. Deleting it to allow the move...');
            await query("DELETE FROM daily_financial_snapshots WHERE date = '2025-12-29'");
        }

        const result = await query(`
            UPDATE daily_financial_snapshots 
            SET date = '2025-12-29' 
            WHERE date = '2025-12-30' AND notes LIKE '%29-DIC%'
        `);
        console.log('Update Result:', result);

        console.log('Verifying result...');
        const verify = await query("SELECT date, notes FROM daily_financial_snapshots WHERE date IN ('2025-12-29', '2025-12-30')");
        console.log('Records now:', JSON.stringify(verify, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
