const { query, poolEnd } = require('./config/database');

async function checkSchema() {
    try {
        const columns = await query('DESCRIBE orders');
        console.log('Orders Table Schema:');
        columns.forEach(col => {
            console.log(`${col.Field} (${col.Type})`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

checkSchema();
