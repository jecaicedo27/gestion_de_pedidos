
const { query, poolEnd } = require('../config/database');

async function backfillProfitPercent() {
    try {
        console.log("📊 Calculando y guardando 'profit_percent'...");

        // Formula: (profit_amount / net_price) * 100
        // Net Price = price * (1 - discount/100)
        // Avoid division by zero

        const result = await query(`
            UPDATE order_items 
            SET profit_percent = CASE 
                WHEN (price * (1 - COALESCE(discount_percent, 0) / 100)) > 0 
                THEN (profit_amount / (price * (1 - COALESCE(discount_percent, 0) / 100))) * 100
                ELSE 0 
            END
        `);

        console.log(`✅ Items actualizados: ${result.affectedRows} filas.`);

    } catch (error) {
        console.error("❌ Error actualizando profit_percent:", error);
    } finally {
        poolEnd();
    }
}

backfillProfitPercent();
