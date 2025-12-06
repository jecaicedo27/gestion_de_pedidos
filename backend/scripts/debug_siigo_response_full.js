const siigoService = require('../services/siigoService');

async function debugFullResponse() {
    try {
        console.log('Authenticating...');
        await siigoService.authenticate();

        console.log('Fetching invoice...');
        // We need the ID of invoice 15436. From previous debug, it was 8101? No, that was tax ID.
        // Let's search by number.
        const invoices = await siigoService.getInvoices({ name: 'FV-2-15436' });

        if (invoices.results && invoices.results.length > 0) {
            const invoiceId = invoices.results[0].id;
            console.log('Found Invoice ID:', invoiceId);

            const fullInvoice = await siigoService.getInvoiceDetails(invoiceId);
            console.log('FULL INVOICE JSON:');
            console.log(JSON.stringify(fullInvoice, null, 2));
        } else {
            console.log('Invoice FV-2-15436 not found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugFullResponse();
