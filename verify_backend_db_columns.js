'use strict';

const { query, poolEnd } = require('./backend/config/database');

(async () => {
  try {
    const dbRes = await query('SELECT DATABASE() AS db');
    const activeDb = dbRes[0]?.db;
    console.log('🗄️ Active DB (backend pool):', activeDb);

    const cols = await query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
         FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'delivery_evidence'
        ORDER BY ORDINAL_POSITION`
    );
    console.log('📋 delivery_evidence columns:', cols.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE}) ${c.IS_NULLABLE}`).join(', '));

    const showCreate = await query('SHOW CREATE TABLE delivery_evidence');
    console.log('\n🧱 SHOW CREATE TABLE delivery_evidence:\n', showCreate[0]['Create Table']);
  } catch (err) {
    console.error('❌ Error verifying backend DB columns:', err.message);
    console.error(err);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
  }
})();
