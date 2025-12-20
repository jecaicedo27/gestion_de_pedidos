
const { query, poolEnd } = require('../config/database');

async function fixNullCosts() {
    try {
        console.log("🔧 Iniciando corrección de items con costo NULL...");

        // UPDATE query
        // 1. purchase_cost = price
        // 2. product_code = description
        // 3. WHERE purchase_cost IS NULL

        const result = await query(`
            UPDATE order_items 
            SET 
                purchase_cost = price,
                product_code = description
            WHERE purchase_cost IS NULL
        `);

        console.log(`✅ Items actualizados: ${result.affectedRows} filas.`);
        console.log("   - Costo establecido igual al precio (Margen 0)");
        console.log("   - Product Code copiado de Description");

    } catch (error) {
        console.error("❌ Error actualizando costos:", error);
    } finally {
        poolEnd();
    }
}

fixNullCosts();
