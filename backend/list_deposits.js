
const { query } = require('./config/database');
require('dotenv').config();

async function listDeposits() {
    try {
        const rows = await query('SELECT id, amount, evidence_file, created_at FROM cartera_deposits ORDER BY id DESC LIMIT 10');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

listDeposits();
