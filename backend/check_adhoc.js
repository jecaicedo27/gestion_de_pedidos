
const { query } = require('./config/database');
require('dotenv').config();

async function checkPayment() {
    try {
        const rows = await query('SELECT * FROM messenger_adhoc_payments WHERE id = ?', [33]);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkPayment();
