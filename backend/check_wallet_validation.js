const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });

async function checkWalletValidation() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // Get order ID
    const [orders] = await connection.execute(
        'SELECT id FROM orders WHERE order_number = ?',
        ['FV-2-15261']
    );

    if (orders.length === 0) {
        console.log('Order not found');
        await connection.end();
        return;
    }

    const orderId = orders[0].id;
    console.log(`Order ID: ${orderId}`);

    // Check wallet_validations
    const [validations] = await connection.execute(
        'SELECT * FROM wallet_validations WHERE order_id = ?',
        [orderId]
    );

    console.log('\n=== Wallet Validations ===');
    console.log(JSON.stringify(validations, null, 2));

    await connection.end();
}

checkWalletValidation().catch(console.error);
