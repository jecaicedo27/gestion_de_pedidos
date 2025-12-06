require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'gestion_pedidos',
};

async function cleanupDuplicates() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Find duplicates
        const [rows] = await connection.execute(`
      SELECT amount, bank_name, reference_number, deposited_by, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id ASC) as ids
      FROM cartera_deposits
      GROUP BY amount, bank_name, reference_number, deposited_by
      HAVING count > 1
    `);

        console.log(`Found ${rows.length} sets of duplicate consignments.`);

        for (const row of rows) {
            const ids = row.ids.split(',');
            const keepId = ids[0]; // Keep the first one (lowest ID)
            const deleteIds = ids.slice(1);

            console.log(`\nProcessing group: Amount=${row.amount}, Bank=${row.bank_name}, Ref=${row.reference_number}`);
            console.log(`  - Keeping ID: ${keepId}`);
            console.log(`  - Deleting IDs: ${deleteIds.join(', ')}`);

            // 2. Delete duplicates (and their details if any)
            // First delete details for the IDs to be deleted
            if (deleteIds.length > 0) {
                const placeholders = deleteIds.map(() => '?').join(',');

                // Delete details
                await connection.execute(
                    `DELETE FROM cartera_deposit_details WHERE deposit_id IN (${placeholders})`,
                    deleteIds
                );
                console.log(`    - Deleted details for IDs: ${deleteIds.join(', ')}`);

                // Delete deposits
                await connection.execute(
                    `DELETE FROM cartera_deposits WHERE id IN (${placeholders})`,
                    deleteIds
                );
                console.log(`    - Deleted deposits with IDs: ${deleteIds.join(', ')}`);
            }
        }

        console.log('\nCleanup completed successfully.');

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        if (connection) await connection.end();
    }
}

cleanupDuplicates();
