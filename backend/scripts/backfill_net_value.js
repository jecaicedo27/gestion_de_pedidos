
const { query } = require('../config/database');
const siigoService = require('../services/siigoService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function backfillNetValue() {
    try {
        console.log('🚀 Iniciando backfill de net_value...');

        // Obtener pedidos sin net_value
        const orders = await query(`
      SELECT id, siigo_invoice_id, order_number 
      FROM orders 
      WHERE net_value IS NULL AND siigo_invoice_id IS NOT NULL
      ORDER BY created_at DESC
    `);

        console.log(`📋 Encontrados ${orders.length} pedidos para actualizar.`);

        let updatedCount = 0;
        let errorCount = 0;

        for (const order of orders) {
            try {
                console.log(`🔄 Procesando pedido ${order.order_number} (ID: ${order.id}, Invoice: ${order.siigo_invoice_id})...`);

                // Obtener detalles de la factura
                const invoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);

                if (!invoice) {
                    console.warn(`⚠️ Factura no encontrada en Siigo para pedido ${order.order_number}`);
                    continue;
                }

                // Calcular net_value
                let netValue = null;
                if (invoice.balance !== undefined && !isNaN(parseFloat(invoice.balance))) {
                    netValue = parseFloat(invoice.balance);
                } else if (invoice.total_amount !== undefined && !isNaN(parseFloat(invoice.total_amount))) {
                    // Fallback to total_amount if balance is missing (though logic says balance is priority)
                    // But wait, if balance is missing, it might mean fully paid?
                    // No, Siigo usually returns balance.
                    // Let's stick to the logic: if balance is present, use it.
                    // If not, we leave it null? Or do we assume total?
                    // The previous logic was: return null if no balance.
                    // But for backfill, maybe we want to be more aggressive?
                    // No, let's stick to the safe logic: Balance is what we want.
                }

                if (netValue !== null) {
                    await query('UPDATE orders SET net_value = ? WHERE id = ?', [netValue, order.id]);
                    console.log(`✅ Pedido ${order.order_number} actualizado con net_value: ${netValue}`);
                    updatedCount++;
                } else {
                    console.log(`ℹ️ No se pudo determinar net_value para pedido ${order.order_number} (Balance: ${invoice.balance})`);
                }

                // Rate limiting manual
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`❌ Error procesando pedido ${order.order_number}:`, error.message);
                errorCount++;
            }
        }

        console.log(`🎉 Backfill completado.`);
        console.log(`✅ Actualizados: ${updatedCount}`);
        console.log(`❌ Errores: ${errorCount}`);

    } catch (error) {
        console.error('❌ Error fatal en backfill:', error);
    } finally {
        process.exit();
    }
}

backfillNetValue();
