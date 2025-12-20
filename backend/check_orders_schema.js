const { query, poolEnd } = require('./config/database');

async function checkSchema() {
    try {
        const result = await query("DESCRIBE orders");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

checkSchema();
