const { query } = require('./backend/config/database');

async function createExpectedItemsTable() {
    try {
        console.log('Creating merchandise_reception_expected_items table...');

        await query(`
            CREATE TABLE IF NOT EXISTS merchandise_reception_expected_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reception_id INT NOT NULL,
                item_code VARCHAR(100),
                item_description TEXT,
                expected_quantity INT NOT NULL,
                scanned_quantity INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reception_id) REFERENCES merchandise_receptions(id) ON DELETE CASCADE,
                INDEX idx_reception_id (reception_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('✅ Table created successfully');
        process.exit(0);

    } catch (error) {
        console.error('Error creating table:', error);
        process.exit(1);
    }
}

createExpectedItemsTable();
