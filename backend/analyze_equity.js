
const { query } = require('./config/database');

(async () => {
    try {
        // Fetch Equity History (date, equity_value, assets breakdown, liabilities)
        const history = await query(`
            SELECT * FROM daily_financial_snapshots 
            ORDER BY date DESC 
            LIMIT 30
        `);

        // Fetch Expenses grouped by date
        const expenses = await query(`
            SELECT payment_date, SUM(amount) as daily_expense 
            FROM expenses 
            WHERE payment_status = 'PAGADO' 
            AND payment_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY payment_date
        `);

        console.log('--- Financial Data Analysis ---');
        console.log(`Loaded ${history.length} snapshots and ${expenses.length} expense days.\n`);

        const data = history.map(h => {
            // Calculate breakdown if columns exist (assuming standard schema from previous context)
            // Defaulting to 0 if null
            const equity = Number(h.total_equity || 0);
            const inventory = Number(h.inventory_value || 0);
            const cash = Number(h.cash_value || 0); // Caja + Bancos
            const receivables = Number(h.receivables_value || 0); // Cartera
            const payables = Number(h.payables_value || 0); // Deuda
            // Add expenses matching date
            const dateStr = new Date(h.date).toISOString().slice(0, 10);
            const expense = expenses.find(e => {
                const eDate = new Date(e.payment_date).toISOString().slice(0, 10);
                return eDate === dateStr;
            });

            return {
                date: dateStr,
                equity,
                inventory,
                cash,
                receivables,
                payables,
                expenses: Number(expense?.daily_expense || 0).toFixed(0)
            };
        }).reverse(); // Sort ASC for trend analysis

        console.table(data);

        // Simple Trend Analysis
        if (data.length > 1) {
            const first = data[0];
            const last = data[data.length - 1];
            const equityGrowth = ((last.equity - first.equity) / first.equity) * 100;
            console.log(`\nGrowth over period: ${equityGrowth.toFixed(2)}%`);
            console.log(`Start Equity: $${first.equity.toLocaleString()}`);
            console.log(`End Equity:   $${last.equity.toLocaleString()}`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
