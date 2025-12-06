const siigoService = require('../services/siigoService');
const axios = require('axios');

async function listQuotationsSample() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        console.log('Listing last 5 quotations...');
        const response = await axios.get(`${baseUrl}/v1/quotations?page_size=5&page=1`, { headers });

        if (response.data.results) {
            response.data.results.forEach(q => {
                console.log(`Quotation ${q.name}:`);
                console.log(JSON.stringify(q, null, 2));
            });
        } else {
            console.log('No quotations found.');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.log(error.response.data);
    }
}

listQuotationsSample();
