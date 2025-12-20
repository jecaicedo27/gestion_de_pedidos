const { pool } = require('./config/database');

async function checkConfig() {
    try {
        const [rows] = await pool.query("SELECT * FROM company_config WHERE config_key = 'siigo_fallback_product_code'");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkConfig();
