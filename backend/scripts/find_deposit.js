const { query, poolEnd } = require('../config/database');

async function findDeposit() {
    try {
        const rows = await query("SELECT id, deposited_at, amount, bank_name, reference_number FROM cartera_deposits WHERE reference_number = '355539'");
        console.log('Found Deposit:', rows);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

findDeposit();
