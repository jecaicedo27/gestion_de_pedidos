
const service = require('./services/siigoService');
const axios = require('axios');

(async () => {
    try {
        await service.authenticate();

        const token = service.token;
        const baseURL = service.baseURL;

        console.log('Fetching Vouchers from Siigo...');

        // Try to fetch vouchers (Recibos de Caja usually have specific type, but let's list all first)
        const response = await axios.get(`${baseURL}/v1/vouchers`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Partner-Id': 'siigo'
            },
            params: {
                page: 1,
                page_size: 5,
                type: 'RC' // Optional: filter by Recibo de Caja if API supports it, otherwise remove
            }
        });

        console.log('Response Status:', response.status);
        console.log('Results Count:', response.data.results?.length);

        if (response.data.results && response.data.results.length > 0) {
            console.log('Sample Voucher:', JSON.stringify(response.data.results[0], null, 2));
        } else {
            console.log('No vouchers found or empty list.');
        }

    } catch (e) {
        console.error('Error fetching vouchers:', e.message);
        if (e.response) {
            console.error('API Error Data:', JSON.stringify(e.response.data, null, 2));
        }
    }
    process.exit(0);
})();
