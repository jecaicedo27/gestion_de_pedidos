
const cron = require('node-cron');
const { query } = require('../config/database');

class ProfitabilityAssuranceService {
    constructor() {
        this.cronTask = null;
        this.isRunning = false;
    }

    // Start the automated check (Runs every hour)
    start() {
        console.log('🛡️ Iniciando Profitability Assurance Service (Verificación de Costos)');

        // Run immediately on startup to fix any pending issues
        this.checkAndFixCosts();

        // Schedule: Every hour at minute 0 (e.g., 1:00, 2:00, 3:00...)
        this.cronTask = cron.schedule('0 * * * *', async () => {
            console.log('🛡️ [Profitability] Ejecutando verificación horaria...');
            await this.checkAndFixCosts();
        });
    }

    async checkAndFixCosts() {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            // 1. Update Zero Cost Items (Priority 1)
            await this.fixZeroCosts();

            // 2. Validate Recent Import Costs (Last 24h)
            // Checks for recently modified items that might have incorrect costs from a fresh import
            await this.resyncRecentCosts();

        } catch (error) {
            console.error('❌ [Profitability] Error en ciclo de verificación:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async fixZeroCosts() {
        const zeroQuery = `
      SELECT oi.id, oi.product_code, oi.name, oi.quantity, oi.price, oi.discount_percent, p.purchasing_price
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.internal_code = oi.product_code
      WHERE (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
      AND oi.product_code NOT IN ('FL01', 'PROPINA')
      AND o.created_at >= NOW() - INTERVAL 7 DAY
      AND p.purchasing_price > 0
    `;

        const items = await query(zeroQuery);
        if (items.length > 0) {
            console.log(`🛡️ [Profitability] Encontrados ${items.length} items con costo cero. Corrigiendo...`);
            await this.updateItems(items);
        }
    }

    async resyncRecentCosts() {
        // Logic: Ensure items from declared "today" matches the master cost
        const syncQuery = `
        SELECT oi.id, oi.product_code, oi.price, oi.quantity, oi.discount_percent, oi.purchase_cost as old_cost, p.purchasing_price as new_cost
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.internal_code = oi.product_code
        WHERE o.created_at >= NOW() - INTERVAL 24 HOUR
        AND p.purchasing_price > 0
        AND ABS(oi.purchase_cost - p.purchasing_price) > 100 -- Tolerance for minor diffs
      `;

        const items = await query(syncQuery);
        if (items.length > 0) {
            console.log(`🛡️ [Profitability] Sincronizando ${items.length} items con discrepancias de costo recientes...`);
            await this.updateItems(items.map(i => ({ ...i, purchasing_price: i.new_cost })));
        }
    }

    async updateItems(items) {
        for (const item of items) {
            const unitCost = parseFloat(item.purchasing_price);
            const unitPrice = parseFloat(item.price);
            const quantity = parseFloat(item.quantity);
            const discount = parseFloat(item.discount_percent) || 0;
            const netUnitPrice = unitPrice * (1 - discount / 100);

            const totalProfit = (netUnitPrice - unitCost) * quantity;
            const profitPercent = netUnitPrice !== 0 ? ((netUnitPrice - unitCost) / netUnitPrice) * 100 : 0;

            await query(
                `UPDATE order_items 
         SET purchase_cost = ?, profit_amount = ?, profit_percent = ?
         WHERE id = ?`,
                [unitCost, totalProfit, profitPercent, item.id]
            );
        }
    }
}

module.exports = new ProfitabilityAssuranceService();
