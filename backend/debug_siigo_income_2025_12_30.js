const siigoService = require('./services/siigoService');

(async () => {
    try {
        const dateStr = '2025-12-30';
        console.log(`Fetching Siigo Vouchers (RC) for ${dateStr}...`);

        const response = await siigoService.getVouchers({
            created_start: '2025-12-30',
            created_end: '2025-12-31',
            type: 'RC',
            page_size: 100
        });

        console.log(`Response received. Total results: ${response.results ? response.results.length : 0}`);

        if (response.results) {
            let targetVouchers = response.results.filter(v => v.date === '2025-12-30');
            console.log(`Matching Vouchers (Date 2025-12-30): ${targetVouchers.length}`);

            targetVouchers.forEach((voucher, index) => {
                console.log(`\n--- Voucher #${index + 1} ---`);
                console.log(`ID: ${voucher.id}`);
                console.log(`Name: ${voucher.name}`);
                console.log(`Date: ${voucher.date}`);
                console.log(`Payment:`, JSON.stringify(voucher.payment, null, 2));

                // Inspect Items logic from scheduler
                const moneyItems = voucher.items ? voucher.items.filter(item =>
                    item.account?.movement === 'Debit' &&
                    item.account?.code?.startsWith('11')
                ) : [];

                console.log(`Items (Debit 11*):`, JSON.stringify(moneyItems, null, 2));

                let amount = 0;
                if (voucher.payment) {
                    amount = Number(voucher.payment.value || 0);
                } else if (voucher.items && Array.isArray(voucher.items)) {
                    amount = moneyItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
                }
                console.log(`Calculated Amount: ${amount}`);
            });
        }

    } catch (err) {
        console.error('Error:', err);
    }
})();
