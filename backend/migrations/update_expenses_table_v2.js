
const { query } = require('../config/database');

async function updateExpensesTable() {
    try {
        console.log('Updating expenses table schema...');

        // Check if columns exist to avoid errors on re-run
        // Ideally we would do a more robust check, but for this environment 'IF NOT EXISTS' in ADD COLUMN works in newer MySQL/MariaDB
        // or we catch the error. Standard MySQL doesn't fully support IF NOT EXISTS in ADD COLUMN easily without a procedure.
        // We will try adding them one by one or in a block assuming they don't exist, or just use a robust query.

        // Since we are in a controlled environment, we'll try to add them. If they fail, it might be because they exist.
        // However, to be safe and avoid "Duplicate column name" fatal errors that stop the script, we can wrap each or just fail gracefully.

        // Let's use a single ALTER TABLE statement. If it fails due to duplicate column, we'll log it.

        const sql = `
            ALTER TABLE expenses
            ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255) AFTER date,
            ADD COLUMN IF NOT EXISTS provider_invoice_number VARCHAR(100) AFTER provider_name,
            ADD COLUMN IF NOT EXISTS siigo_fc_number VARCHAR(100) AFTER provider_invoice_number,
            ADD COLUMN IF NOT EXISTS payment_date DATE AFTER amount,
            ADD COLUMN IF NOT EXISTS siigo_status ENUM('PENDIENTE', 'APLICADO') DEFAULT 'PENDIENTE' AFTER source,
            ADD COLUMN IF NOT EXISTS siigo_rp_number VARCHAR(100) AFTER siigo_status,
            ADD COLUMN IF NOT EXISTS cost_center VARCHAR(100) AFTER category,
            ADD COLUMN IF NOT EXISTS concept TEXT AFTER cost_center;
        `;

        // Note: IF NOT EXISTS for ADD COLUMN is supported in MariaDB 10.2.1+ and MySQL 8.0.29+.
        // If the user is on an older version, this syntax might fail.
        // Let's try it. If it fails, we fall back to a more manual approach.

        await query(sql);
        console.log('Expenses table updated successfully (all columns added).');
        process.exit(0);

    } catch (error) {
        if (error.code === 'ER_PARSE_ERROR' || error.sqlMessage.includes('syntax')) {
            console.log('Syntax error detected (likely old MySQL version), trying legacy mode...');
            try {
                // Legacy mode: Try adding columns one by one, ignoring "Duplicate column" error (ClientError 1060)
                const columns = [
                    "ADD COLUMN provider_name VARCHAR(255) AFTER date",
                    "ADD COLUMN provider_invoice_number VARCHAR(100) AFTER provider_name",
                    "ADD COLUMN siigo_fc_number VARCHAR(100) AFTER provider_invoice_number",
                    "ADD COLUMN payment_date DATE AFTER amount",
                    "ADD COLUMN siigo_status ENUM('PENDIENTE', 'APLICADO') DEFAULT 'PENDIENTE' AFTER source",
                    "ADD COLUMN siigo_rp_number VARCHAR(100) AFTER siigo_status",
                    "ADD COLUMN cost_center VARCHAR(100) AFTER category",
                    "ADD COLUMN concept TEXT AFTER cost_center" // We'll map 'concept' to replace or augment description
                ];

                for (const colSql of columns) {
                    try {
                        await query(`ALTER TABLE expenses ${colSql}`);
                        console.log(`Executed: ${colSql}`);
                    } catch (innerErr) {
                        if (innerErr.code === 'ER_DUP_FIELDNAME') {
                            console.log(`Skipped (already exists): ${colSql.split(' ')[2]}`);
                        } else {
                            throw innerErr;
                        }
                    }
                }
                console.log('Expenses table updated successfully (legacy mode).');
                process.exit(0);
            } catch (legacyError) {
                console.error('Error in legacy migration:', legacyError);
                process.exit(1);
            }
        } else {
            console.error('Error updating table:', error);
            process.exit(1);
        }
    }
}

updateExpensesTable();
