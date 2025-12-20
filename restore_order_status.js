const { pool } = require('./backend/config/database');

async function run() {
    try {
        const orderNumber = 'FV-2-15446';
        console.log(`Restoring status for order ${orderNumber}...`);

        const [result] = await pool.execute(
            `UPDATE orders 
       SET status = 'listo_para_entrega' 
       WHERE order_number = ? AND status = 'en_logistica'`,
            [orderNumber]
        );

        console.log('Update result:', result);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
