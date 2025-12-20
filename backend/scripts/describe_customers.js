
const { query, poolEnd } = require('../config/database');

async function describe() {
    try {
        const rows = await query("DESCRIBE customers");
        console.log(rows.map(r => r.Field));
    } catch (error) {
        console.error(error);
    } finally {
        poolEnd();
    }
}

describe();
