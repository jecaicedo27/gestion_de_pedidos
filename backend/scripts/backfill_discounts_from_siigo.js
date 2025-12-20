const { query, poolEnd } = require('../config/database');
const siigoService = require('../services/siigoService');

async function backfillDiscounts() {
    try {
        console.log("🔄 Actualizando descuentos desde SIIGO sin reimportar...");

        // Get all orders that have SIIGO invoice IDs
        const orders = await query(`
      SELECT id, order_number, siigo_invoice_id 
      FROM orders 
      WHERE siigo_invoice_id IS NOT NULL
      ORDER BY created_at DESC
    `);

        console.log(`📦 Encontrados ${orders.length} pedidos con facturas SIIGO`);

        let updated = 0;
        let errors = 0;

        for (const order of orders) {
            try {
                console.log(`\n🔍 Procesando ${order.order_number}...`);

                // Fetch invoice details from SIIGO
                const invoiceData = await siigoService.getInvoiceDetails(order.siigo_invoice_id);

                if (!invoiceData || !invoiceData.items) {
                    console.log(`⚠️ No se encontraron items para ${order.order_number}`);
                    continue;
                }

                // Update discount for each item
                for (let i = 0; i < invoiceData.items.length; i++) {
                    const item = invoiceData.items[i];
                    const invoiceLine = i + 1;

                    console.log(`  📋 Item ${invoiceLine}: ${item.description}`);
                    console.log(`     Descuento SIIGO:`, item.discount);

                    // Extract discount percentage from SIIGO structure
                    // item.discount can be: {percentage: 25, value: 151260.5} or just a number
                    let discount = 0;
                    if (item.discount && typeof item.discount === 'object') {
                        discount = parseFloat(item.discount.percentage || 0);
                    } else {
                        discount = parseFloat(item.discount || 0);
                    }

                    // Update by order_id and invoice_line
                    const result = await query(`
                      UPDATE order_items 
                      SET discount_percent = ? 
                      WHERE order_id = ? AND invoice_line = ?
                    `, [discount, order.id, invoiceLine]);

                    if (result.affectedRows > 0) {
                        console.log(`  ✅ Línea ${invoiceLine}: ${discount}% descuento actualizado`);
                    } else {
                        console.log(`  ⚠️ Línea ${invoiceLine}: No se encontró el item (affected: 0)`);
                    }
                }

                updated++;

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (err) {
                console.error(`❌ Error en ${order.order_number}:`, err.message);
                errors++;
            }
        }

        console.log(`\n✅ Proceso completado:`);
        console.log(`   Actualizados: ${updated}`);
        console.log(`   Errores: ${errors}`);

    } catch (error) {
        console.error("❌ Error crítico:", error);
    } finally {
        poolEnd();
    }
}

backfillDiscounts();
