const { query, poolEnd } = require('./config/database');

async function inspect() {
    try {
        const result = await query('DESCRIBE expenses');
        console.table(result);
    } catch (e) {
        console.error(e);
    } finally {
        await poolEnd();
        process.exit();
    }
}

inspect();
