
const { query } = require('../config/database');

async function createExpensesTable() {
    try {
        console.log('Creating expenses table...');
        await query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        source ENUM('bancolombia', 'mercadopago') NOT NULL,
        category ENUM(
            'ARRIENDO', 
            'EXTRA-EMPLEADOS', 
            'MARCA', 
            'PRODUCTO', 
            'SALARIO', 
            'TRANSPORTE-CLIENTES', 
            'TRANSPORTE-DISTRIBUIDORES', 
            'OTROS'
        ) NOT NULL,
        description TEXT,
        evidence_url VARCHAR(255),
        created_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_date (date),
        INDEX idx_source (source),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('Expenses table created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error creating table:', error);
        process.exit(1);
    }
}

createExpensesTable();
