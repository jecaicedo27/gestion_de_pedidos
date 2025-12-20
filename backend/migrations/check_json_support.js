const { query } = require('../config/database');

async function checkJsonSupport() {
    try {
        console.log('🔍 Checking JSON_ARRAYAGG support...');
        const result = await query("SELECT JSON_ARRAYAGG(JSON_OBJECT('id', 1, 'name', 'test')) as test");
        console.log('✅ JSON_ARRAYAGG supported:', JSON.stringify(result));
    } catch (error) {
        console.log('❌ JSON_ARRAYAGG NOT supported');
        // console.error(error);
    }
    process.exit(0);
}

checkJsonSupport();
