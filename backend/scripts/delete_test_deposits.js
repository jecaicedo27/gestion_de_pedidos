const { query, poolEnd } = require('../config/database');

async function deleteTestDeposits() {
    try {
        // Find IDs first to log them
        const rows = await query("SELECT id, reference_number FROM cartera_deposits WHERE reference_number LIKE 'TEST-%' OR reference_number = '1111'");
        console.log('Deleting deposits:', rows);

        if (rows.length > 0) {
            const ids = rows.map(r => r.id);
            // mysql2 doesn't support array expansion in prepared statements automatically in all versions/modes
            // Manual expansion
            const placeholders = ids.map(() => '?').join(',');
            await query(`DELETE FROM cartera_deposits WHERE id IN (${placeholders})`, ids);
            console.log('Deleted successfully.');
        } else {
            console.log('No test deposits found.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

deleteTestDeposits();
