
require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'gestion_pedidos'
};

async function checkOrderItems() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const query = `
            SELECT 
                id,
                product_code, 
                name, 
                quantity, 
                price, 
                discount_percent,
                purchase_cost, 
                profit_amount
            FROM order_items 
            WHERE order_id = 358;
        `;

        const [rows] = await connection.execute(query);
        console.table(rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkOrderItems();
