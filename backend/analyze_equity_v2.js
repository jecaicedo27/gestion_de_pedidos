
const { query } = require('./config/database');

(async () => {
    try {
        const history = await query(`
            SELECT 
                date,
                total_equity,
                inventory_value as inventory,
                cash_in_hand as cash,
                money_in_circulation as circulation,
                bank_balance as banks,
                mercado_pago_balance as mp,
                receivables,
                payables
            FROM daily_financial_snapshots 
            ORDER BY date DESC 
            LIMIT 10
        `);

        // Format dates
        const formatted = history.map(h => ({
            ...h,
            date: new Date(h.date).toISOString().slice(0, 10),
            total_equity: Number(h.total_equity).toLocaleString(),
            payables: Number(h.payables).toLocaleString()
        })).reverse();

        console.table(formatted);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
