const { query } = require('./config/database');

async function checkSchema() {
    try {
        const result = await query("SHOW COLUMNS FROM wallet_validations WHERE Field = 'validation_type'");
        console.log('validation_type column schema:', JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
