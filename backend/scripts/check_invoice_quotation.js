const siigoService = require('../services/siigoService');
const axios = require('axios');

async function checkInvoiceForQuotation() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        // Get invoice FV-2-15387 (the one related to quotation C-1-9890)
        console.log('Fetching invoice FV-2-15387...');
        const response = await axios.get(`${baseUrl}/v1/invoices?name=FV-2-15387`, { headers });

        if (response.data.results && response.data.results.length > 0) {
            const invoice = response.data.results[0];
            console.log('\n=== INVOICE DETAILS ===');
            console.log(JSON.stringify(invoice, null, 2));

            // Check for quotation-related fields
            console.log('\n=== CHECKING FOR QUOTATION FIELDS ===');
            console.log('Has quotation field?', invoice.quotation ? 'YES' : 'NO');
            console.log('Has related_quotation field?', invoice.related_quotation ? 'YES' : 'NO');
            console.log('Has quotation_id field?', invoice.quotation_id ? 'YES' : 'NO');
            console.log('Has observations field?', invoice.observations ? 'YES' : 'NO');

            if (invoice.quotation) {
                console.log('Quotation data:', JSON.stringify(invoice.quotation, null, 2));
            }
            if (invoice.observations) {
                console.log('Observations:', invoice.observations);
            }
        } else {
            console.log('Invoice not found');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.log(error.response.data);
    }
}

checkInvoiceForQuotation();
