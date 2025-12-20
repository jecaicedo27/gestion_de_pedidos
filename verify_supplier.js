const { query } = require('./backend/config/database');
require('dotenv').config({ path: './backend/.env' });
const fs = require('fs');

async function check() {
    try {
        const rows = await query('SELECT supplier FROM product_inventory_config WHERE product_id = 19523');
        fs.writeFileSync('verify_output.txt', JSON.stringify(rows, null, 2));
        console.log('Done');
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('verify_output.txt', e.message);
        process.exit(1);
    }
}
check();
