const { pool } = require('./backend/config/database');

async function run() {
    try {
        const query = `
      SELECT o.id, o.order_number, o.status, o.payment_method, o.requires_payment, o.validation_status, o.deleted_at
      FROM orders o 
      WHERE o.order_number = 'FV-2-15446'
    `;

        console.log('Query:', query);
        console.log('Params:', []);

        const [rows] = await pool.execute(query, []);
        console.log('Result:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
