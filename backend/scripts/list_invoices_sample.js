const siigoService = require('../services/siigoService');
const axios = require('axios');

async function listInvoicesSample() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        console.log('Listing last 5 invoices...');
        const response = await axios.get(`${baseUrl}/v1/invoices?page_size=5&page=1`, { headers });

        if (response.data.results) {
            response.data.results.forEach(inv => {
                console.log(`Invoice ${inv.name}: Document ID = ${inv.document.id} (Type: ${inv.document.id})`);
                console.log('Document Object:', JSON.stringify(inv.document, null, 2));
            });
        } else {
            console.log('No invoices found.');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.log(error.response.data);
    }
}

listInvoicesSample();
