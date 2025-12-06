require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

async function createTable() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'gestion_pedidos'
        });

        console.log('Connected to database');

        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS order_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        action VARCHAR(255) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order_id (order_id),
        INDEX idx_action (action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

        await connection.execute(createTableQuery);
        console.log('order_history table created successfully');

        await connection.end();
    } catch (error) {
        console.error('Error creating table:', error);
    }
}

createTable();
