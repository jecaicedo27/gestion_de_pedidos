const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });

async function listOrdersWithEvidence() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('--- Orders with evidence in orders table ---');
    const [ordersLegacy] = await connection.execute(
        'SELECT order_number, payment_evidence_path FROM orders WHERE payment_evidence_path IS NOT NULL LIMIT 5'
    );
    console.table(ordersLegacy);

    console.log('\n--- Orders with evidence in payment_evidences table ---');
    const [ordersNew] = await connection.execute(`
    SELECT o.order_number, pe.file_path 
    FROM payment_evidences pe 
    JOIN orders o ON pe.order_id = o.id 
    LIMIT 5
  `);
    console.table(ordersNew);

    await connection.end();
}

listOrdersWithEvidence().catch(console.error);
