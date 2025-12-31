const { query, poolEnd } = require('./config/database');

async function listExpenses() {
    try {
        const rows = await query(`
            SELECT id, date, provider_name, amount, payment_date, siigo_fc_number 
            FROM expenses 
            ORDER BY id DESC 
            LIMIT 15
        `);
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await poolEnd();
        process.exit();
    }
}

listExpenses();
