const { query } = require('./backend/config/database');

async function addNitColumn() {
    try {
        console.log('Adding supplier_nit column to merchandise_receptions...');

        await query(`
            ALTER TABLE merchandise_receptions 
            ADD COLUMN supplier_nit VARCHAR(50) AFTER supplier
        `);

        console.log('✅ Column added successfully');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists');
            process.exit(0);
        }
        console.error('Error:', error);
        process.exit(1);
    }
}

addNitColumn();
