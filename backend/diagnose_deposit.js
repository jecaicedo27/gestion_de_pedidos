
const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function diagnose() {
    const logFile = 'diagnosis.txt';
    const log = (msg) => fs.appendFileSync(logFile, msg + '\n');

    try {
        fs.writeFileSync(logFile, 'Starting diagnosis...\n');

        // 1. Query DB
        log('Querying DB for ID 33...');
        const rows = await query('SELECT * FROM cartera_deposits WHERE id = 33');

        if (rows.length === 0) {
            log('❌ Deposit ID 33 NOT FOUND in database.');
            // List recent to see what IDs exist
            const recent = await query('SELECT id FROM cartera_deposits ORDER BY id DESC LIMIT 5');
            log('Recent IDs: ' + recent.map(r => r.id).join(', '));
        } else {
            const deposit = rows[0];
            log('✅ Deposit ID 33 found.');
            log('Evidence file in DB: ' + (deposit.evidence_file || 'NULL'));

            if (deposit.evidence_file) {
                const filePath = path.join(__dirname, 'uploads/deposits', deposit.evidence_file);
                log('Checking file path: ' + filePath);
                if (fs.existsSync(filePath)) {
                    log('✅ File EXISTS on disk.');
                    const stats = fs.statSync(filePath);
                    log('File size: ' + stats.size + ' bytes');
                } else {
                    log('❌ File does NOT exist on disk.');
                }
            } else {
                log('⚠️ No evidence file recorded in database.');
            }
        }

        process.exit(0);
    } catch (error) {
        log('❌ Error: ' + error.message);
        console.error(error);
        process.exit(1);
    }
}

diagnose();
