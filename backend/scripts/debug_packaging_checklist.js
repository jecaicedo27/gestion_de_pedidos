/**
 * Debug: Mostrar checklist de empaque que consume la UI (excluye items 'replaced')
 * Uso:
 *   node backend/scripts/debug_packaging_checklist.js 158
 */
const { query } = require('../config/database');

(async () => {
  try {
    const orderId = Number(process.argv[2]);
    if (!Number.isFinite(orderId)) {
      console.log('❌ Uso: node backend/scripts/debug_packaging_checklist.js <orderId>');
      process.exit(1);
    }

    // Verificar existencia de columna invoice_line por compat
    const col = await query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'order_items'
        AND COLUMN_NAME = 'invoice_line'
    `);
    const hasInvoiceLine = (col[0]?.cnt || 0) > 0;
    const selectInvoiceLine = hasInvoiceLine ? 'oi.invoice_line,' : '';
    const orderClause = hasInvoiceLine
      ? `ORDER BY 
          CASE WHEN oi.invoice_line IS NULL THEN 1 ELSE 0 END,
          oi.invoice_line ASC,
          oi.id ASC`
      : 'ORDER BY oi.id ASC';

    const sql = `
      SELECT 
        oi.id,
        oi.name,
        oi.quantity,
        oi.price,
        ${selectInvoiceLine}
        oi.product_code,
        oi.status,
        piv.is_verified,
        piv.scanned_count,
        piv.required_scans
      FROM order_items oi
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = ?
      WHERE oi.order_id = ?
        AND oi.status <> 'replaced'
      ${orderClause}
    `;

    const rows = await query(sql, [orderId, orderId]);

    console.log(`\n🧪 Checklist (excluyendo 'replaced') para order_id=${orderId}`);
    if (!rows.length) {
      console.log('Sin items activos.');
      process.exit(0);
    }

    rows.forEach(r => {
      const req = Number(r.required_scans || r.quantity || 0);
      const scn = Number(r.scanned_count || 0);
      console.log(`- [${r.id}] ${r.name}`);
      console.log(`    status: ${r.status} | required: ${req} | progress: ${scn}/${req} | is_verified: ${r.is_verified ? 'true' : 'false'}${hasInvoiceLine ? ` | line: ${r.invoice_line ?? '-'}` : ''}`);
    });

    const total = rows.length;
    const verified = rows.filter(r => Number(r.is_verified || 0) === 1).length;
    const withProgress = rows.filter(r => Number(r.scanned_count || 0) > 0).length;

    console.log('\nResumen (solo activos):');
    console.log(`- Items con progreso: ${withProgress}/${total}`);
    console.log(`- Items verificados:  ${verified}/${total}`);

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e?.message || e);
    process.exit(1);
  }
})();
