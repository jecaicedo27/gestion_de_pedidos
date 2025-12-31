
const { query } = require('../config/database');

async function createDailyFinancialSnapshotsTable() {
    const sql = `
    CREATE TABLE IF NOT EXISTS daily_financial_snapshots (
      date DATE PRIMARY KEY,
      inventory_value DECIMAL(20, 2) DEFAULT 0,
      money_in_circulation DECIMAL(20, 2) DEFAULT 0,
      cash_in_hand DECIMAL(20, 2) DEFAULT 0,
      bank_balance DECIMAL(20, 2) DEFAULT 0,
      receivables DECIMAL(20, 2) DEFAULT 0,
      payables DECIMAL(20, 2) DEFAULT 0,
      total_equity DECIMAL(20, 2) DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `;

    try {
        await query(sql);
        console.log('✅ Tabla daily_financial_snapshots creada/verificada correctamente.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creando tabla daily_financial_snapshots:', error);
        process.exit(1);
    }
}

createDailyFinancialSnapshotsTable();
