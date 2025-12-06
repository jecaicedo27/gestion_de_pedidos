const { query, poolEnd } = require('../config/database');

async function describeQuotations() {
    try {
        console.log('Describing quotations table...');
        const result = await query('DESCRIBE quotations');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await poolEnd();
    }
}

describeQuotations();
