
const { query } = require('./config/database');
require('dotenv').config();

async function checkDeposit() {
    try {
        const rows = await query('SELECT * FROM cartera_deposits WHERE id = ?', [33]);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkDeposit();
