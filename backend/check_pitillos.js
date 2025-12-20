require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkProduct() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    const [rows] = await connection.execute(
        "SELECT id, name, internal_code, barcode, siigo_id FROM products WHERE name LIKE '%PITILLOS%'"
    );

    console.log(rows);
    await connection.end();
}

checkProduct();
