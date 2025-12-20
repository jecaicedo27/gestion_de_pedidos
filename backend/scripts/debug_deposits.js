const { createDeposit } = require('../controllers/treasuryController');
const { query, poolEnd } = require('../config/database');

// Mock request and response
const req = {
    body: {
        amount: 1000,
        bank_name: 'Test Bank',
        reference_number: 'TEST-' + Date.now(),
        deposited_at: '2025-12-07', // Today
        notes: 'Test deposit from debug script'
    },
    user: { id: 1 } // Admin
};

const res = {
    status: (code) => ({
        json: (data) => console.log(`Status ${code}:`, data)
    }),
    json: (data) => console.log('Success:', data)
};

async function run() {
    try {
        console.log('Creating test deposit...');
        // createDeposit is [middleware, handler]
        const handler = Array.isArray(createDeposit) ? createDeposit[createDeposit.length - 1] : createDeposit;
        await handler(req, res);

        // Check the DB directly
        const rows = await query('SELECT id, deposited_at, created_at FROM cartera_deposits ORDER BY id DESC LIMIT 1');
        console.log('Latest in DB after test:', rows[0]);
        console.log('Deposited At ISO:', new Date(rows[0].deposited_at).toISOString());
        console.log('Deposited At Local:', rows[0].deposited_at.toString());
    } catch (e) {
        console.error(e);
    } finally {
        await poolEnd();
    }
}

run();
