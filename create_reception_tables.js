const { pool } = require('./backend/config/database');
require('dotenv').config({ path: './backend/.env' });

async function createTables() {
    try {
        console.log('🚀 Creating merchandise reception tables...');

        // Table: merchandise_receptions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS merchandise_receptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                supplier VARCHAR(255) NOT NULL,
                invoice_number VARCHAR(100),
                invoice_file_path VARCHAR(500),
                status ENUM('pending', 'completed') DEFAULT 'pending',
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL
            )
        `);
        console.log('✅ Table merchandise_receptions created/verified.');

        // Table: merchandise_reception_items
        await pool.query(`
            CREATE TABLE IF NOT EXISTS merchandise_reception_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reception_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                cost DECIMAL(10, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reception_id) REFERENCES merchandise_receptions(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `);
        console.log('✅ Table merchandise_reception_items created/verified.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        process.exit(1);
    }
}

createTables();
