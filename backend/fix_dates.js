const { query, poolEnd } = require('./config/database');

async function fixDates() {
    try {
        console.log('Fixing Invoice Dates for IDs 14-18...');
        await query("UPDATE expenses SET date = NULL WHERE id IN (14, 15, 16, 17, 18)");
        console.log('Update successful.');
    } catch (e) {
        console.error('Update failed:', e);
    } finally {
        await poolEnd();
        process.exit();
    }
}

fixDates();
