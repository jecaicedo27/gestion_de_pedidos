// Preview de pendientes Cartera: bodega_eligible y bodega (cash_register pending)
// Uso: node backend/scripts/debug_cartera_pending_preview.js [FV-2-15021]
const { query, poolEnd } = require('../config/database');

(async () => {
  const number = process.argv[2] || 'FV-2-15021';
  try {
    const eligibleStatuses = ['en_logistica','en_empaque','empacado','listo','listo_para_entrega'];
    const sqlEligible = `
      SELECT o.id, o.order_number, o.status, o.delivery_method, o.payment_method, o.total_amount
      FROM orders o
      WHERE LOWER(COALESCE(o.delivery_method,'')) IN ('recoge_bodega','recogida_tienda')
        AND LOWER(COALESCE(o.payment_method,'')) IN ('efectivo','contado')
        AND o.status IN (${eligibleStatuses.map(() => '?').join(',')})
        AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
      ORDER BY o.updated_at DESC
      LIMIT 500`;

    const rowsEligible = await query(sqlEligible, eligibleStatuses);
    const focusEligible = rowsEligible.filter(r => String(r.order_number).trim() === String(number).trim());

    console.log('Eligible (bodega_eligible) total:', rowsEligible.length);
    console.log('Eligible focus:', focusEligible);

    const sqlBodega = `
      SELECT cr.id AS cash_register_id, o.order_number, cr.status, cr.amount, cr.created_at
      FROM cash_register cr 
      JOIN orders o ON o.id = cr.order_id
      WHERE (cr.status IS NULL OR cr.status <> 'collected')
      ORDER BY cr.created_at DESC
      LIMIT 500`;
    const rowsBodega = await query(sqlBodega, []);
    const focusBodega = rowsBodega.filter(r => String(r.order_number).trim() === String(number).trim());
    console.log('Bodega pending total:', rowsBodega.length);
    console.log('Bodega focus:', focusBodega);
  } catch (e) {
    console.error('Error:', e.message || e);
  } finally {
    await poolEnd();
  }
})();
