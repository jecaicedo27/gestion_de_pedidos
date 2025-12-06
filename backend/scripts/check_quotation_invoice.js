const siigoService = require('../services/siigoService');
const axios = require('axios');

async function getQuotationDetails() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        // Get quotation C-1-9890
        console.log('Fetching quotation details for C-1-9890...');
        const response = await axios.get(`${baseUrl}/v1/quotations?name=C-1-9890`, { headers });

        if (response.data.results && response.data.results.length > 0) {
            const quotation = response.data.results[0];
            console.log('\n=== QUOTATION DETAILS ===');
            console.log(JSON.stringify(quotation, null, 2));

            // Check for invoice-related fields
            console.log('\n=== CHECKING FOR INVOICE FIELDS ===');
            console.log('Has invoice field?', quotation.invoice ? 'YES' : 'NO');
            console.log('Has related_invoice field?', quotation.related_invoice ? 'YES' : 'NO');
            console.log('Has invoice_id field?', quotation.invoice_id ? 'YES' : 'NO');
            console.log('Has metadata?', quotation.metadata ? 'YES' : 'NO');

            if (quotation.metadata) {
                console.log('Metadata:', JSON.stringify(quotation.metadata, null, 2));
            }
        } else {
            console.log('Quotation not found');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.log(error.response.data);
    }
}

getQuotationDetails();
