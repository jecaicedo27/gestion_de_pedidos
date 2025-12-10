const mysql = require('mysql2/promise');
require('dotenv').config();

async function createPaymentEvidencesTable() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'gestion_pedidos'
    });

    try {
        console.log('🔄 Creating payment_evidences table...');

        await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment_evidences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_by INT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_order_id (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        console.log('✅ Table payment_evidences created successfully');

        // Migrate existing data if any
        console.log('🔄 Migrating existing payment evidence data...');
        const [orders] = await connection.execute(
            'SELECT id, payment_evidence_path FROM orders WHERE payment_evidence_path IS NOT NULL AND payment_evidence_path != ""'
        );

        let migratedCount = 0;
        for (const order of orders) {
            // Check if already migrated
            const [existing] = await connection.execute(
                'SELECT id FROM payment_evidences WHERE order_id = ? AND file_path = ?',
                [order.id, order.payment_evidence_path]
            );

            if (existing.length === 0) {
                await connection.execute(
                    'INSERT INTO payment_evidences (order_id, file_path) VALUES (?, ?)',
                    [order.id, order.payment_evidence_path]
                );
                migratedCount++;
            }
        }

        console.log(`✅ Migrated ${migratedCount} existing payment evidences`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

createPaymentEvidencesTable();
