
const { query, poolEnd } = require('../config/database');

async function backfillProfitV2() {
    try {
        console.log("💰 Recalculando 'profit_amount' incluyendo CANTIDAD...");

        // Formula: (Net Price - Purchase Cost) * Quantity
        // Net Price = price * (1 - discount_percent / 100)

        const result = await query(`
            UPDATE order_items 
            SET profit_amount = (
                ((price * (1 - COALESCE(discount_percent, 0) / 100)) - purchase_cost) * quantity
            )
        `);

        console.log(`✅ Items actualizados: ${result.affectedRows} filas.`);
        console.log("   Formula aplicada: ((price * (1-disc)) - cost) * quantity");

    } catch (error) {
        console.error("❌ Error actualizando profit_amount:", error);
    } finally {
        poolEnd();
    }
}

backfillProfitV2();
