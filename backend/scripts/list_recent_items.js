
const { query, poolEnd } = require('../config/database');

async function listItems() {
    try {
        console.log("🔍 Listando últimos 10 items vendidos...");
        const sql = `SELECT name, price, purchase_cost FROM order_items ORDER BY created_at DESC LIMIT 10`;
        const rows = await query(sql);
        console.table(rows);
    } catch (error) {
        console.error(error);
    } finally {
        poolEnd();
    }
}

listItems();
