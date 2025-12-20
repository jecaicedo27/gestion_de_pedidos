require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });
const mysql = require('mysql2/promise');

async function createTable() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS supplier_product_codes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                supplier_code VARCHAR(100) NOT NULL,
                barcode VARCHAR(100) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_supplier_code (supplier_code),
                INDEX idx_barcode (barcode)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await connection.execute(createTableQuery);
        console.log('Table supplier_product_codes created or already exists.');

    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        if (connection) await connection.end();
    }
}

createTable();
