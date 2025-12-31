
const siigoService = require('../services/siigoService');

async function debugSiigo() {
    try {
        const dateStr = '2025-12-30'; // Today
        console.log(`🔎 Debugging Siigo Vouchers for ${dateStr}...`);

        // Mimic Scheduler Call
        const response = await siigoService.getVouchers({
            created_start: dateStr, // Explicitly filter by creation date
            created_end: dateStr,
            // type: 'RC', // Comment out type to see ALL
            page_size: 100, // Small page
            skip_date_validation: false // Allow enforcement
        });

        console.log(`✅ Result Count: ${response.results ? response.results.length : 0}`);

        if (response.results && response.results.length > 0) {
            console.log('--- First 3 Vouchers ---');
            response.results.slice(0, 3).forEach((v, i) => {
                console.log(`[${i}] ID: ${v.id} | Name: ${v.name} | Date: ${v.date} | Value: ${v.payment?.value}`);
                console.log(JSON.stringify(v, null, 2));
            });
        } else {
            console.log('⚠️ No results found. Trying without type filter?');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

debugSiigo();
