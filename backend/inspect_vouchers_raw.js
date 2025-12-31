
const service = require('./services/siigoService');

(async () => {
    try {
        await service.authenticate();

        console.log('Fetching Vouchers without type filter to see structure...');
        const vouchers = await service.getVouchers({
            page_size: 5,
            date_start: '2025-12-30',
            date_end: '2025-12-30',
            type: 'RC'
        });

        if (vouchers.results) {
            vouchers.results.forEach((v, i) => {
                console.log(`\n--- Voucher ${i} ---`);
                console.log(JSON.stringify(v, null, 2));
            });
        }
        process.exit(0);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
