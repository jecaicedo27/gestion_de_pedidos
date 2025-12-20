const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });

async function analyzeEvidence() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // Describe orders
    const [columns] = await connection.execute('DESCRIBE orders');
    const columnNames = columns.map(c => c.Field);
    console.log('Orders columns:', columnNames.filter(c => c.includes('evidence') || c.includes('path') || c.includes('file')));

    // Count orders with evidence in orders table
    const [ordersCount] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE payment_evidence_path IS NOT NULL');
    console.log('Orders with payment_evidence_path:', ordersCount[0].count);

    // Count rows in payment_evidences
    const [evidencesCount] = await connection.execute('SELECT COUNT(*) as count FROM payment_evidences');
    console.log('Total rows in payment_evidences:', evidencesCount[0].count);

    await connection.end();
}

analyzeEvidence().catch(console.error);
