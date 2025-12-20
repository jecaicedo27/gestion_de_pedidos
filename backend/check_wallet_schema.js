const { query } = require('./config/database');

async function checkSchema() {
    try {
        const columns = await query("SHOW COLUMNS FROM wallet_validations");
        console.log(JSON.stringify(columns, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
