
const { query } = require('../config/database');

async function checkDB() {
    try {
        console.log('Checking siigo_income_daily for recent dates...');
        const rows = await query("SELECT * FROM siigo_income_daily WHERE date >= '2025-12-28' ORDER BY date DESC");
        console.table(rows);

        console.log('Checking siigo_expenses_daily for recent dates...');
        const expRows = await query("SELECT * FROM siigo_expenses_daily WHERE date >= '2025-12-28' ORDER BY date DESC");
        console.table(expRows);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkDB();
