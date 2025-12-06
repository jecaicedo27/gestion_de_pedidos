
require('dotenv').config();
const mysql = require('mysql2/promise');

async function describeUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute('DESCRIBE users');
        console.table(rows);
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

describeUsers();
