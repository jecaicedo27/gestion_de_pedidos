const { query } = require('../config/database');

async function createTable() {
    try {
        console.log('Creating messenger_adhoc_payments table...');
        await query(`
      CREATE TABLE IF NOT EXISTS messenger_adhoc_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        messenger_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        evidence_url VARCHAR(255),
        status ENUM('pending', 'collected', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_by INT NULL,
        accepted_at DATETIME NULL,
        notes TEXT,
        FOREIGN KEY (messenger_id) REFERENCES users(id),
        FOREIGN KEY (accepted_by) REFERENCES users(id)
      )
    `);
        console.log('Table created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error creating table:', error);
        process.exit(1);
    }
}

createTable();
