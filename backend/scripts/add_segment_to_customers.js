
const { query, poolEnd } = require('../config/database');

async function migrate() {
    try {
        console.log("Adding 'segment' column to customers table...");
        await query(`
      ALTER TABLE customers 
      ADD COLUMN segment VARCHAR(50) DEFAULT 'Minorista' 
      AFTER email
    `);
        console.log("✅ 'segment' column added successfully.");
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("ℹ️ 'segment' column already exists.");
        } else {
            console.error("❌ Error adding column:", error);
        }
    } finally {
        poolEnd();
    }
}

migrate();
