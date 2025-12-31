
const { pool } = require('../config/database');
const scheduler = require('../services/siigoSyncScheduler');

async function main() {
    try {
        console.log('Forcing Siigo Sync...');
        await scheduler.syncToday();
        console.log('Sync Complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
