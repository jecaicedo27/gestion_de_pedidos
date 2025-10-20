const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const { query } = require('../backend/config/database');
const siigoService = require('../backend/services/siigoService');

async function backfill() {
  try {
    console.log('🔎 Buscando pedidos con siigo_invoice_id y sin siigo_invoice_created_at...');
    const orders = await query(`
      SELECT id, siigo_invoice_id, order_number
      FROM orders
      WHERE siigo_invoice_id IS NOT NULL
        AND (siigo_invoice_created_at IS NULL OR siigo_invoice_created_at = '0000-00-00 00:00:00')
      ORDER BY id DESC
      LIMIT 2000
    `);

    console.log(`📦 Encontrados ${orders.length} pedidos para actualizar`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        if (!order.siigo_invoice_id) {
          skipped++;
          continue;
        }

        // Obtener detalles de la factura desde SIIGO
        const invoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);

        const createdRaw = invoice?.created || invoice?.date || null;
        if (!createdRaw) {
          console.log(`⚠️  Pedido ${order.id} (${order.order_number}) sin campo created/date en SIIGO`);
          skipped++;
          continue;
        }

        const createdAt = new Date(createdRaw);
        if (isNaN(createdAt.getTime())) {
          console.log(`⚠️  Pedido ${order.id} (${order.order_number}) fecha inválida: ${createdRaw}`);
          skipped++;
          continue;
        }

        await query(
          `UPDATE orders SET siigo_invoice_created_at = ? WHERE id = ?`,
          [createdAt, order.id]
        );

        updated++;
        console.log(`✅ Pedido ${order.id} (${order.order_number}) actualizado -> ${createdAt.toISOString()}`);
      } catch (err) {
        failed++;
        console.error(`❌ Error actualizando pedido ${order.id} (${order.order_number}):`, err.message);
      }
    }

    console.log('='.repeat(80));
    console.log('🏁 Proceso completado');
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`⚠️  Omitidos: ${skipped}`);
    console.log(`❌ Fallidos : ${failed}`);
    console.log('='.repeat(80));
  } catch (error) {
    console.error('❌ Error en backfill:', error.message);
    process.exit(1);
  } finally {
    // El pool lo maneja backend/config/database, no necesitamos cerrar explícitamente aquí
  }
}

if (require.main === module) {
  backfill();
}

module.exports = { backfill };
