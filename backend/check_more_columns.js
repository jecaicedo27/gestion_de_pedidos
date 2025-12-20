const { query } = require('./config/database');

async function checkMoreColumns() {
    try {
        const statusCol = await query("SHOW COLUMNS FROM orders LIKE 'status'");
        console.log('Status Column:', JSON.stringify(statusCol, null, 2));

        const paidCol = await query("SHOW COLUMNS FROM orders LIKE 'paid_amount'");
        console.log('Paid Amount Column:', JSON.stringify(paidCol, null, 2));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkMoreColumns();
