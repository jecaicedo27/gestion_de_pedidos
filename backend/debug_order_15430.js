const { query, poolEnd } = require('./config/database');

async function checkOrder() {
    try {
        const rows = await query('SELECT * FROM orders WHERE order_number LIKE "%15430%"');
        console.log(rows);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

checkOrder();
