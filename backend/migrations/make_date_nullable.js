const { query, poolEnd } = require('../config/database');

async function migrate() {
    try {
        console.log('Modifying expenses table: Making "date" nullable...');
        await query("ALTER TABLE expenses MODIFY COLUMN date DATE NULL");
        console.log('Migration successful.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await poolEnd();
        process.exit();
    }
}

migrate();
