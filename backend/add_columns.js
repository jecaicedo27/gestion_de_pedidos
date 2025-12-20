const { query } = require('./config/database');

async function addColumns() {
    try {
        console.log('Adding validation_status column...');
        await query("ALTER TABLE orders ADD COLUMN validation_status VARCHAR(50) DEFAULT NULL");
        console.log('validation_status added.');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('validation_status already exists.');
        } else {
            console.error('Error adding validation_status:', error);
        }
    }

    try {
        console.log('Adding validation_notes column...');
        await query("ALTER TABLE orders ADD COLUMN validation_notes TEXT DEFAULT NULL");
        console.log('validation_notes added.');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('validation_notes already exists.');
        } else {
            console.error('Error adding validation_notes:', error);
        }
    }

    process.exit(0);
}

addColumns();
