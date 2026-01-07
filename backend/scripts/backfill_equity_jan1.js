require('dotenv').config({ path: '../.env' });
const financialController = require('../controllers/financialController');
const { query } = require('../config/database');

async function backfill() {
    try {
        console.log('🔄 Backfilling Equity Snapshot for 2026-01-01...');

        // Ensure connection is ready? Usually required.
        // We can just call the method.

        await financialController.captureAutoSnapshot('2026-01-01');

        console.log('✅ Backfill Complete.');
    } catch (error) {
        console.error('❌ Error in backfill:', error);
    } finally {
        process.exit();
    }
}

backfill();
