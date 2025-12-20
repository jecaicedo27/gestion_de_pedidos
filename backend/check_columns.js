const { query } = require('./config/database');

async function checkColumns() {
    try {
        const columns = await query("SHOW COLUMNS FROM orders");
        console.log('Columns in orders table:');
        columns.forEach(col => console.log(col.Field));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkColumns();
