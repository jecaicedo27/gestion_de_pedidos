
const { query } = require('../config/database');
const configService = require('../services/configService');

async function checkConfig() {
    try {
        const configDate = await configService.getConfig('siigo_sync_start_date');
        console.log('Configured Start Date:', configDate);

        const defaultDate = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
        console.log('Default Start Date (30 days ago):', defaultDate);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkConfig();
