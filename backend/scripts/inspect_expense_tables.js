
const { query } = require('../config/database');

async function checkTables() {
    try {
        console.log('--- Cartera Movements ---');
        const cartera = await query('DESCRIBE cartera_movements');
        console.log(cartera.map(c => `${c.Field} (${c.Type})`));

        console.log('\n--- Cash Register ---');
        const cash = await query('DESCRIBE cash_register');
        console.log(cash.map(c => `${c.Field} (${c.Type})`));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkTables();
