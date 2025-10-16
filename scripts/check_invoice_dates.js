const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const { query, poolEnd } = require('../backend/config/database');

(async () => {
  try {
    console.log('🔎 Verificando pedidos con siigo_invoice_created_at...');

    const [counts] = await Promise.all([
      query(`SELECT 
                SUM(CASE WHEN siigo_invoice_created_at IS NOT NULL THEN 1 ELSE 0 END) AS with_date,
                SUM(CASE WHEN siigo_invoice_created_at IS NULL THEN 1 ELSE 0 END) AS without_date,
                COUNT(*) AS total
             FROM orders`)
    ]);

    console.log('📊 Conteo global:', counts);

    const recentWithDate = await query(
      `SELECT id, order_number, siigo_invoice_id, siigo_invoice_created_at
         FROM orders
        WHERE siigo_invoice_created_at IS NOT NULL
        ORDER BY id DESC
        LIMIT 20`
    );

    console.log('\n✅ Pedidos recientes con fecha de factura (máx 20):');
    recentWithDate.forEach(o => {
      console.log(` - #${o.id} ${o.order_number} | factura_id=${o.siigo_invoice_id} | fecha=${o.siigo_invoice_created_at}`);
    });

    const recentWithoutDate = await query(
      `SELECT id, order_number, siigo_invoice_id
         FROM orders
        WHERE siigo_invoice_created_at IS NULL AND siigo_invoice_id IS NOT NULL
        ORDER BY id DESC
        LIMIT 10`
    );

    console.log('\n⚠️ Pedidos con factura SIIGO pero sin fecha (máx 10):');
    recentWithoutDate.forEach(o => {
      console.log(` - #${o.id} ${o.order_number} | factura_id=${o.siigo_invoice_id}`);
    });

  } catch (err) {
    console.error('❌ Error verificando fechas de factura:', err.message);
    process.exit(1);
  } finally {
    await poolEnd();
  }
})();
