const siigoService = require('../services/siigoService');
const { query } = require('../config/database');

async function run() {
    const start = '2025-12-01';
    const end = '2025-12-31';

    console.log(`🚀 Starting Smart Backfill (Fetch by Creation Date) from ${start} to ${end}...`);
    try {
        // Fetch all vouchers CREATED in this range
        // This is much faster and accurate than querying by document date which Siigo ignores
        const response = await siigoService.getVouchers({
            created_start: start,
            created_end: end,
            type: 'RC',
            page_size: 100
        });

        console.log(`📊 Retrieved ${response.results?.length || 0} vouchers created in this period.`);

        if (!response.results || response.results.length === 0) {
            console.log('⚠️ No vouchers found.');
            process.exit(0);
        }

        // Aggregate by Document Date
        // Map: '2025-12-01' -> { total: 0, details: {} }
        const validDates = {};

        response.results.forEach(voucher => {
            const dateStr = voucher.date; // Document date
            if (!validDates[dateStr]) {
                validDates[dateStr] = { total: 0, accounts: {} };
            }

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

            validDates[dateStr].total += amount;
            if (!validDates[dateStr].accounts[accountName]) validDates[dateStr].accounts[accountName] = 0;
            validDates[dateStr].accounts[accountName] += amount;
        });

        // Save to DB
        console.log('💾 Saving to database...');
        const dates = Object.keys(validDates).sort();

        for (const d of dates) {
            const data = validDates[d];
            await query(`
            INSERT INTO siigo_income_daily (date, total_amount, details_json, last_updated)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              total_amount = VALUES(total_amount),
              details_json = VALUES(details_json),
              last_updated = NOW()
        `, [d, data.total, JSON.stringify(data.accounts)]);
            console.log(`   ✅ ${d}: $${data.total.toLocaleString()}`);
        }

        console.log('✅ Smart Backfill successful');
        process.exit(0);
    } catch (error) {
        console.error('❌ Backfill failed:', error);
        process.exit(1);
    }
}

run();
