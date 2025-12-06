const { query } = require('../config/database');

async function createExternalDriversTable() {
    try {
        await query(`
      CREATE TABLE IF NOT EXISTS external_drivers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        plate VARCHAR(50),
        phone VARCHAR(50),
        city VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        console.log('Table external_drivers created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error creating table:', error);
        process.exit(1);
    }
}

createExternalDriversTable();
