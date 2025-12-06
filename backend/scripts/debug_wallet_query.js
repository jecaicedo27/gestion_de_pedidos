const { query } = require('../config/database');

async function run() {
    try {
        console.log('Checking order 246 (15373)...');
        const order = await query('SELECT id, order_number, status, is_pending_payment_evidence FROM orders WHERE id = 246');
        console.log('Order state:', order);

        console.log('Simulating Wallet Query...');
        const status = 'revision_cartera';
        let whereClause = 'WHERE o.deleted_at IS NULL';
        const params = [];

        if (status === 'revision_cartera') {
            whereClause += ' AND (o.status = ? OR o.is_pending_payment_evidence = 1)';
        } else {
            whereClause += ' AND o.status = ?';
        }
        params.push(status);

        const sql = `SELECT o.id, o.order_number, o.status, o.is_pending_payment_evidence FROM orders o ${whereClause} AND o.id = 246`;
        console.log('SQL:', sql);
        console.log('Params:', params);

        const result = await query(sql, params);
        console.log('Query Result:', result);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
