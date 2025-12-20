const { query } = require('./config/database');

async function checkTypes() {
    try {
        const columns = await query("SHOW COLUMNS FROM orders LIKE 'validation_%'");
        console.log(JSON.stringify(columns, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkTypes();
