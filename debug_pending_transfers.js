const { pool } = require('./backend/config/database');

async function run() {
    try {
        console.log('Testing getPendingTransfers query...');
        const [rows] = await pool.execute(`
        SELECT o.*, 
               u.username as created_by_name
        FROM orders o
        LEFT JOIN users u ON o.created_by = u.id
        WHERE o.status = 'pending_payment' 
          AND o.payment_method IN ('transferencia', 'mixto')
        ORDER BY o.created_at DESC
    `);
        console.log(`Success! Found ${rows.length} rows.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error executing query:', error);
        process.exit(1);
    }
}

run();
