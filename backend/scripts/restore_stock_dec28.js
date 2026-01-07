require('dotenv').config({ path: '../.env' });
const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function restoreStock() {
    try {
        console.log('🔄 Iniciando restauración de inventario desde snapshot 2025-12-28...');

        // Query the snapshot from Dec 28 (latest entry per product for that day)
        // Note: The history might duplicate rows if run multiple times, picking the last one for that day.

        const snapshotRows = await query(`
            WITH DailyRanked AS (
                SELECT 
                    h.product_id,
                    h.current_stock,
                    h.analysis_date,
                    ROW_NUMBER() OVER (PARTITION BY h.product_id ORDER BY h.analysis_date DESC) as rn
                FROM inventory_analysis_history h
                WHERE DATE(h.analysis_date) = '2025-12-28'
            )
            SELECT product_id, current_stock
            FROM DailyRanked
            WHERE rn = 1
        `);

        console.log(`📋 Encontrados ${snapshotRows.length} registros de inventario del 28 de diciembre.`);

        let updatedCount = 0;
        let zeroCount = 0;

        for (const row of snapshotRows) {
            const stock = Number(row.current_stock);

            // Safety check: Don't restore if stock was 0 back then? 
            // The user implies they had stock. We trust the snapshot.

            await query(`
                UPDATE products 
                SET available_quantity = ?, 
                    stock_updated_at = NOW(), 
                    updated_at = NOW() 
                WHERE id = ?
            `, [stock, row.product_id]);

            updatedCount++;
            if (stock === 0) zeroCount++;
        }

        console.log(`✅ Restauración completada: ${updatedCount} productos actualizados.`);
        if (zeroCount > 0) console.log(`⚠️  ${zeroCount} productos se restauraron a 0 (estaban en 0 el 28 dic).`);

    } catch (error) {
        console.error('❌ Error restaurando inventario:', error);
    } finally {
        process.exit();
    }
}

restoreStock();
