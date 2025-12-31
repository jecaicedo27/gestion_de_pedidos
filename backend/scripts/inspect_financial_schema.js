
const { query } = require('../config/database');

async function checkSchema() {
    try {
        const rows = await query("DESCRIBE daily_financial_snapshots");
        console.log(rows);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
