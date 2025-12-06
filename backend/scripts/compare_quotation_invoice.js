const siigoService = require('../services/siigoService');
const axios = require('axios');

async function compareQuotationAndInvoice() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        // Get quotation C-1-9890
        console.log('Fetching quotation C-1-9890...');
        const quotResponse = await axios.get(`${baseUrl}/v1/quotations?name=C-1-9890`, { headers });

        // Get invoice FV-2-15387
        console.log('Fetching invoice FV-2-15387...');
        const invResponse = await axios.get(`${baseUrl}/v1/invoices?name=FV-2-15387`, { headers });

        if (quotResponse.data.results && quotResponse.data.results.length > 0 &&
            invResponse.data.results && invResponse.data.results.length > 0) {

            const quotation = quotResponse.data.results[0];
            const invoice = invResponse.data.results[0];

            console.log('\n=== COMPARISON ===');
            console.log('Quotation ID:', quotation.id);
            console.log('Quotation Customer ID:', quotation.customer?.id);
            console.log('Quotation Date:', quotation.date);
            console.log('Quotation Total:', quotation.total);
            console.log('Quotation Items:', quotation.items?.length);

            console.log('\nInvoice ID:', invoice.id);
            console.log('Invoice Customer ID:', invoice.customer?.id);
            console.log('Invoice Date:', invoice.date);
            console.log('Invoice Total:', invoice.total);
            console.log('Invoice Items:', invoice.items?.length);

            // Check if customers match
            console.log('\n=== MATCHING CRITERIA ===');
            console.log('Same customer?', quotation.customer?.id === invoice.customer?.id);
            console.log('Same total?', quotation.total === invoice.total);
            console.log('Same item count?', quotation.items?.length === invoice.items?.length);

            // Compare items
            if (quotation.items && invoice.items) {
                console.log('\n=== ITEM COMPARISON ===');
                const quotItems = quotation.items.map(i => ({ code: i.code, qty: i.quantity, price: i.price }));
                const invItems = invoice.items.map(i => ({ code: i.code, qty: i.quantity, price: i.price }));

                console.log('Quotation items:', JSON.stringify(quotItems, null, 2));
                console.log('Invoice items:', JSON.stringify(invItems, null, 2));
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.log(error.response.data);
    }
}

compareQuotationAndInvoice();
