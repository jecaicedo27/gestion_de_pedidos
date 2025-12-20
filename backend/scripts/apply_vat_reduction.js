
const { query, poolEnd } = require('../config/database');

async function removeVatFromCosts() {
    try {
        console.log("📉 Iniciando reducción de costos (DIVIDIR POR 1.19)...");

        // 1. Update Products Table
        console.log("   Actualizando tabla 'products'...");
        const resultProducts = await query(`
            UPDATE products 
            SET purchasing_price = purchasing_price / 1.19 
            WHERE purchasing_price > 0
        `);
        console.log(`   ✅ Productos actualizados: ${resultProducts.affectedRows}`);

        // 2. Update Order Items (Historical Snapshot)
        console.log("   Actualizando tabla 'order_items' (2025)...");
        const resultItems = await query(`
            UPDATE order_items 
            SET purchase_cost = purchase_cost / 1.19 
            WHERE purchase_cost > 0
            AND created_at >= '2025-01-01 00:00:00'
        `);
        console.log(`   ✅ Items de pedido actualizados: ${resultItems.affectedRows}`);

    } catch (error) {
        console.error("❌ Error actualizando costos:", error);
    } finally {
        poolEnd();
    }
}

removeVatFromCosts();
