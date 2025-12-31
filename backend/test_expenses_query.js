const { query, poolEnd } = require('./config/database');

async function testGetExpenses() {
    try {
        console.log('Testing getExpenses query...');

        // Simulate the query used in getExpenses
        // SELECT * FROM expenses WHERE 1=1 ORDER BY date DESC, id DESC
        const sql = 'SELECT * FROM expenses WHERE 1=1 ORDER BY date DESC, id DESC LIMIT 5';
        const rows = await query(sql);
        console.log('Query successful. Rows:', rows.length);
        console.table(rows[0]); // Print first row to check structure

    } catch (e) {
        console.error('Query FAILED:', e);
    } finally {
        await poolEnd();
        process.exit();
    }
}

testGetExpenses();
