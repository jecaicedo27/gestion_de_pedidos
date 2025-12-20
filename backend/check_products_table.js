const { query } = require('./config/database');

async function checkProductsTable() {
    try {
        const columns = await query('DESCRIBE products');
        console.log('Products table columns:');
        columns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkProductsTable();
