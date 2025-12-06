
require('dotenv').config();
const mysql = require('mysql2/promise');

async function inspectUser() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute('SELECT * FROM users LIMIT 1');
        console.log(Object.keys(rows[0]));
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

inspectUser();
