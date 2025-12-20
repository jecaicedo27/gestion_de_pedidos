const { pool } = require('./config/database');

async function checkColumns() {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM company_config");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkColumns();
