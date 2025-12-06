const { query, poolEnd } = require('./config/database');

async function checkTable() {
    try {
        const rows = await query("SHOW TABLES LIKE 'webhook_subscriptions'");
        console.log('Table exists:', rows.length > 0);

        if (rows.length > 0) {
            const columns = await query("DESCRIBE webhook_subscriptions");
            console.log('Columns:', columns);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

checkTable();
