
const { query } = require('./config/database');
require('dotenv').config();

async function findDeposit() {
    try {
        const rows = await query(`
      SELECT * FROM cartera_deposits 
      WHERE amount = 400000 
      AND reference_number = '742773'
    `);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

findDeposit();
