
const db = require('../config/database');

async function checkConfig() {
    try {
        const rows = await db.query('SELECT config_key FROM system_config');
        console.log(rows.map(r => r.config_key).join('\n'));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkConfig();
