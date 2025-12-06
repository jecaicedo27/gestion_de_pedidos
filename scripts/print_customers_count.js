const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const { query } = require('../backend/config/database');

(async () => {
  try {
    const total = await query('SELECT COUNT(*) as c FROM customers');
    const withSiigo = await query('SELECT COUNT(*) as c FROM customers WHERE siigo_id IS NOT NULL');
    const active = await query('SELECT COUNT(*) as c FROM customers WHERE active = 1');
    const sample = await query('SELECT id, name, identification, document_type FROM customers ORDER BY id DESC LIMIT 5');
    console.log('Total customers:', total[0].c);
    console.log('With siigo_id:', withSiigo[0].c);
    console.log('Active:', active[0].c);
    console.log('Last 5 rows:', sample);
    process.exit(0);
  } catch (e) {
    console.error('Error printing counts:', e);
    process.exit(1);
  }
})();
