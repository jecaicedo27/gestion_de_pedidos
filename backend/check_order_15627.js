const { query, poolEnd } = require('./config/database');

async function checkOrder() {
    try {
        const sql = "SELECT id, order_number, status, delivery_method, payment_method, validation_status, validation_notes, is_service FROM orders WHERE order_number = 'FV-2-15627' OR id = 15627";
        const results = await query(sql);
        console.log(JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('Error querying order:', error);
    } finally {
        await poolEnd();
    }
}

checkOrder();
