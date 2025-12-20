const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });

async function describeTable() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [columns] = await connection.execute('DESCRIBE payment_evidences');
    console.log(JSON.stringify(columns, null, 2));

    await connection.end();
}

describeTable().catch(console.error);
