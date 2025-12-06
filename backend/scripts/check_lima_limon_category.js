#!/usr/bin/env node
const { query, poolEnd } = require('../config/database');

(async () => {
  try {
    const rows = await query(`
      SELECT id, product_name, internal_code, category, subcategory, is_active, available_quantity, barcode, siigo_id
      FROM products
      WHERE internal_code IN ('SKARCHA12','SKARCHA7')
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('Error:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(()=>{});
  }
})();
