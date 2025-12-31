const { query } = require('../config/database');
const siigoService = require('../services/siigoService');

(async () => {
    try {
        const targetDate = '2025-12-30';
        console.log(`🔧 Fixing Siigo Income for ${targetDate}...`);

        // Fetch wide creation window to catch backdated/late entries
        const response = await siigoService.getVouchers({
            created_start: '2025-12-30',
            created_end: '2025-12-31',
            type: 'RC',
            page_size: 100
        });

        if (!response.results) {
            console.log('No results found.');
            process.exit(0);
        }

        // Filter items that strictly belong to targetDate accounting-wise
        const validVouchers = response.results.filter(v => v.date === targetDate);
        console.log(`Found ${validVouchers.length} vouchers for date ${targetDate} (out of ${response.results.length} fetched).`);

        let totalIncome = 0;
        const accounts = {};

        validVouchers.forEach(voucher => {
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

        console.log(`💰 Total Income Calculated: $${totalIncome.toLocaleString()}`);
        console.log('Accounts:', accounts);

        // Update DB
        await query(`
            INSERT INTO siigo_income_daily (date, total_amount, details_json, last_updated)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              total_amount = VALUES(total_amount),
              details_json = VALUES(details_json),
              last_updated = NOW()
        `, [targetDate, totalIncome, JSON.stringify(accounts)]);

        console.log('✅ Database updated successfully.');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
})();
