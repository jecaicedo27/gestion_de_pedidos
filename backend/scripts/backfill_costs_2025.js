
const { query, poolEnd } = require('../config/database');

async function backfillCosts() {
    try {
        console.log("🚀 Iniciando Backfill de Costos para 2025...");

        // 1. Contar items afectados antes
        const preCheck = await query(`
            SELECT COUNT(*) as count 
            FROM order_items oi
            WHERE (oi.purchase_cost IS NULL OR oi.purchase_cost = 0)
            AND oi.created_at >= '2025-01-01 00:00:00'
        `);
        console.log(`📋 Items sin costo encontrados (2025): ${preCheck[0].count}`);

        // 2. Ejecutar Update (Solo si el producto tiene costo > 0)
        const updateSql = `
            UPDATE order_items oi
            JOIN products p ON oi.name = p.product_name
            SET oi.purchase_cost = p.purchasing_price
            WHERE (oi.purchase_cost IS NULL OR oi.purchase_cost = 0)
            AND p.purchasing_price > 0
            AND oi.created_at >= '2025-01-01 00:00:00';
        `;

        const result = await query(updateSql);
        console.log(`✅ Fill completado.`);
        console.log(`   Filas afectadas: ${result.affectedRows}`);
        console.log(`   Filas cambiadas: ${result.changedRows}`);

        // 3. Verificación rápida
        const postCheck = await query(`
            SELECT COUNT(*) as count 
            FROM order_items oi
            WHERE (oi.purchase_cost IS NULL OR oi.purchase_cost = 0)
            AND oi.created_at >= '2025-01-01 00:00:00'
        `);
        console.log(`📋 Items restantes sin costo (pueden ser Fletes o prod sin costo): ${postCheck[0].count}`);

    } catch (error) {
        console.error("❌ Error en backfill:", error);
    } finally {
        poolEnd();
    }
}

backfillCosts();
