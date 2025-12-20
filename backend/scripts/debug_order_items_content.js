
const { query, poolEnd } = require('../config/database');

async function debug() {
    try {
        const rows = await query("SELECT * FROM order_items ORDER BY id DESC LIMIT 1");
        console.log(rows[0]);
    } catch (error) {
        console.error(error);
    } finally {
        poolEnd();
    }
}

debug();
