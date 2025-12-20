const { query } = require('./config/database');

async function checkOrder() {
    try {
        const rows = await query("SELECT id, order_number, status, is_service, delivery_method, payment_method, validation_status FROM orders WHERE order_number LIKE '%15415%'");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkOrder();
