
const { query } = require('../config/database');

async function addCol() {
    try {
        await query("ALTER TABLE daily_financial_snapshots ADD COLUMN mercado_pago_balance DECIMAL(20,2) DEFAULT 0.00 AFTER bank_balance");
        console.log("Column added successfully");
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists");
            process.exit(0);
        }
        console.error(error);
        process.exit(1);
    }
}

addCol();
