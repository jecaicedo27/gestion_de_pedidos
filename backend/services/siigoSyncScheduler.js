const { query } = require('../config/database');
const siigoService = require('./siigoService');
const financialController = require('../controllers/financialController');

class SiigoSyncScheduler {
    constructor() {
        this.intervalId = null;
        this.inventoryIntervalId = null;
        this.equityIntervalId = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('⏰ Siigo Sync Scheduler started');

        // 1. Financial Sync (Income/Expenses) - Hourly
        setTimeout(() => this.syncToday(), 10 * 1000);
        this.intervalId = setInterval(() => {
            this.syncToday();
        }, 60 * 60 * 1000);

        // 2. Inventory Sync - Every 30 Minutes
        console.log('⏰ Scheduling Inventory Sync every 30 mins');
        setTimeout(() => this.syncInventory(), 20 * 1000); // 20s start delay
        this.inventoryIntervalId = setInterval(() => {
            this.syncInventory();
        }, 30 * 60 * 1000);

        // 3. Equity Snapshot - Daily at 23:50
        console.log('⏰ Scheduling Daily Equity Snapshot Check');
        this.scheduleDailySnapshot();
    }

    scheduleDailySnapshot() {
        // Run check every hour. If it's near midnight (e.g. 23:xx), run the snapshot.
        // Or simpler: Check every hour. If time is 23:00-23:59 AND we haven't run it for today?
        // Better: SetTimeout to next 23:50.

        const now = new Date();
        const target = new Date(now);
        target.setHours(23, 50, 0, 0); // 23:50

        if (now > target) {
            // If already past 23:50 today, schedule for tomorrow
            target.setDate(target.getDate() + 1);
        }

        const delay = target - now;
        console.log(`⏰ Next Equity Snapshot scheduled in ${(delay / 1000 / 60).toFixed(1)} mins`);

        this.equityIntervalId = setTimeout(() => {
            this.runEquitySnapshot();
            // Reschedule recursively
            this.scheduleDailySnapshot();
        }, delay);
    }

    async runEquitySnapshot() {
        console.log('📸 [SCHEDULER] Running Daily Equity Snapshot...');
        try {
            await financialController.captureAutoSnapshot();
        } catch (error) {
            console.error('❌ [SCHEDULER] Equity Snapshot Failed:', error);
        }
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.inventoryIntervalId) {
            clearInterval(this.inventoryIntervalId);
            this.inventoryIntervalId = null;
        }
        if (this.equityIntervalId) {
            clearTimeout(this.equityIntervalId);
            this.equityIntervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Siigo Sync Scheduler stopped');
    }

    async syncInventory() {
        console.log('🔄 [SCHEDULER] Running Scheduled Inventory Sync...');
        try {
            const result = await siigoService.syncAllInventory();
            if (result.success) {
                console.log(`✅ [SCHEDULER] Inventory Sync Success. Updated: ${result.count}`);
            } else {
                console.warn(`⚠️ [SCHEDULER] Inventory Sync Finished with warnings.`);
            }
        } catch (error) {
            console.error('❌ [SCHEDULER] Inventory Sync Failed:', error.message);
        }
    }

    async syncToday() {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        console.log(`🔄 Syncing Siigo Data (Income & Expenses) for TODAY (${today})...`);
        await Promise.all([
            this.syncDate(today),
            this.syncExpensesDate(today)
        ]);
    }

    async syncDate(dateStr) {
        return this._syncIncome(dateStr);
    }

    async _syncIncome(dateStr) {
        try {
            const response = await siigoService.getVouchers({
                date_start: dateStr,
                date_end: dateStr,
                type: 'RC',
                page_size: 100,
                page_size: 100
            });

            let totalIncome = 0;
            const accounts = {};

            if (response.results) {
                response.results.forEach(voucher => {
                    // Safety Filter: Ensure it is Income (RC)
                    if (voucher.name && !voucher.name.startsWith('RC-')) return;

                    let amount = 0;
                    let accountName = 'Desconocido';

                    if (voucher.payment) {
                        amount = Number(voucher.payment.value || 0);
                        accountName = voucher.payment.name || 'Sin Nombre';
                    } else if (voucher.items && Array.isArray(voucher.items)) {
                        const moneyItems = voucher.items.filter(item =>
                            item.account?.movement === 'Debit' &&
                            item.account?.code?.startsWith('11')
                        );
                        if (moneyItems.length > 0) {
                            amount = moneyItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
                            accountName = moneyItems.map(i => i.description || i.account?.name || 'Caja/Banco').join(' + ');
                        }
                    }

                    totalIncome += amount;
                    if (!accounts[accountName]) accounts[accountName] = 0;
                    accounts[accountName] += amount;
                });
            }

            await query(`
        INSERT INTO siigo_income_daily (date, total_amount, details_json, last_updated)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          total_amount = VALUES(total_amount),
          details_json = VALUES(details_json),
          last_updated = NOW()
      `, [dateStr, totalIncome, JSON.stringify(accounts)]);

            console.log(`✅ Siigo Income Synced for ${dateStr}: $${totalIncome.toLocaleString()}`);
            return true;
        } catch (error) {
            console.error(`❌ Error syncing Siigo Income for ${dateStr}:`, error.message);
            return false;
        }
    }

    async syncExpensesDate(dateStr) {
        try {
            // Fetch potential expenses (CE, G, P)
            // We ask for 'CE', but handle mixed results
            const response = await siigoService.getVouchers({
                date_start: dateStr,
                date_end: dateStr,
                type: 'CE',
                page_size: 100,
                page_size: 100
            });

            let totalExpense = 0;
            const details = [];

            if (response.results) {
                response.results.forEach(voucher => {
                    // 🛡️ CRITICAL FILTER: Ignore 'RC-' documents that slip through
                    const name = voucher.name || '';
                    const typeCode = (voucher.document && voucher.document.code) || '';

                    // We accept 'CE-' (Comprobante Egreso) or 'G-' (Gastos) or specific codes
                    const isExpense = name.startsWith('CE-') || name.startsWith('G-') || name.startsWith('CP-') || typeCode === 'CE';

                    if (!isExpense) return;

                    let amount = 0;
                    // For Expenses, we look for CREDITS to Bank/Cash (1105/1110) OR Debits to Expense/Cost/Liability (5, 6, 2)
                    // The 'value' at top level might be valid.
                    // Usually total value of voucher is the expense amount.

                    // Siigo API structure varies. 
                    // Attempt to use top-level value if available, or sum items.
                    // For simple Vouchers endpoint, 'value' is often present on the item summary? Or detailed items?
                    // The probe showed: Sample: RC-1-12359 -> {"value": 2288490.72 ...}
                    // Let's rely on top level value for simplicity if present, OR detailed accounting items analysis.

                    // Simple approach: Use total value of document
                    // But filter out if status is annulled? API usually filters active ones?
                    // Assuming 'active'.

                    // If detailed items are missing, use document total.
                    // If detailed items exist, sum the Debits to classes 5 (Gastos), 6 (Costos), 2 (Pasivos - paying debt)?
                    // Paying debt (2) affects equity (Cash down, Liability down) -> Still an outflow.
                    // So "Total Value" of the CE is usually the Cash Outflow amount.

                    // HOWEVER, verify if 'value' is present.
                    // In the probe: Sample: ... "value":120500

                    // Let's use the 'value' property if it exists.
                    if (voucher.hasOwnProperty('value')) {
                        amount = Number(voucher.value || 0);
                    } else if (voucher.items) {
                        // Keep primitive logic if top value missing: Sum of all items? No, that would double count (Dr=Cr).
                        // Use max of Dr or Cr? Or header total?
                        // Let's assume header total is available in standard 'getVouchers' response.
                        amount = 0; // Fallback
                    }

                    if (amount > 0) {
                        totalExpense += amount;
                        details.push({
                            id: voucher.id,
                            name: voucher.name,
                            date: voucher.date,
                            value: amount,
                            items: voucher.items // Keep for debug if needed
                        });
                    }
                });
            }

            await query(`
        INSERT INTO siigo_expenses_daily (date, total_amount, details_json, last_updated)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          total_amount = VALUES(total_amount),
          details_json = VALUES(details_json),
          last_updated = NOW()
      `, [dateStr, totalExpense, JSON.stringify(details)]);

            console.log(`✅ Siigo Expenses Synced for ${dateStr}: $${totalExpense.toLocaleString()}`);
            return true;
        } catch (error) {
            console.error(`❌ Error syncing Siigo Expenses for ${dateStr}:`, error.message);
            return false;
        }
    }

    async syncRange(startDate, endDate) {
        console.log(`🔄 Mass Syncing Siigo Data from ${startDate} to ${endDate}...`);
        const date = new Date(startDate);
        const end = new Date(endDate);

        while (date <= end) {
            const dateStr = date.toISOString().split('T')[0];
            await this.syncDate(dateStr); // Income
            await this.syncExpensesDate(dateStr); // Expenses
            date.setDate(date.getDate() + 1);
            await new Promise(r => setTimeout(r, 1000));
        }
        console.log('✅ Mass Sync Complete');
    }
}

module.exports = new SiigoSyncScheduler();
