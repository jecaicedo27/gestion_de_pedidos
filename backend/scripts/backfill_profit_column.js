
const { query, poolEnd } = require('../config/database');

async function backfillProfit() {
    try {
        console.log("💰 Calculando y guardando 'profit_amount' para todos los items...");

        // Formula: Net Price - Purchase Cost
        // Net Price = price * (1 - discount_percent / 100)

        const result = await query(`
            UPDATE order_items 
            SET profit_amount = (
                (price * (1 - COALESCE(discount_percent, 0) / 100)) - purchase_cost
            )
        `);

        console.log(`✅ Items actualizados: ${result.affectedRows} filas.`);
        console.log("   Formula aplicada: (price * (1 - discount/100)) - purchase_cost");

    } catch (error) {
        console.error("❌ Error actualizando profit_amount:", error);
    } finally {
        poolEnd();
    }
}

backfillProfit();
