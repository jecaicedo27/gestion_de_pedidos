
const { query, poolEnd } = require('../config/database');

async function backfillProfitPercentV2() {
    try {
        console.log("📊 Recalculando 'profit_percent' (Safe Formula)...");

        // Safe Formula: ((Net Price - Cost) / Net Price) * 100
        // Independent of quantity or profit_amount column
        // Net Price = price * (1 - discount/100)

        const result = await query(`
            UPDATE order_items 
            SET profit_percent = CASE 
                WHEN (price * (1 - COALESCE(discount_percent, 0) / 100)) > 0 
                THEN (
                    ((price * (1 - COALESCE(discount_percent, 0) / 100)) - purchase_cost) 
                    / (price * (1 - COALESCE(discount_percent, 0) / 100))
                ) * 100
                ELSE 0 
            END
        `);

        console.log(`✅ Items actualizados: ${result.affectedRows} filas.`);
        console.log("   Formula aplicada: ((NetPrice - Cost) / NetPrice) * 100");

    } catch (error) {
        console.error("❌ Error actualizando profit_percent:", error);
    } finally {
        poolEnd();
    }
}

backfillProfitPercentV2();
