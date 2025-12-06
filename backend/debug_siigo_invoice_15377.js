
require('dotenv').config();
const siigoService = require('./services/siigoService');

async function run() {
    try {
        const invoiceId = '8c2f1af0-5e06-4572-acfe-5adcd12ec3ef';
        console.log(`Fetching invoice details for ID: ${invoiceId}`);
        const invoice = await siigoService.getInvoiceDetails(invoiceId);

        console.log('--- Top Level Fields ---');
        console.log('Total:', invoice.total);
        console.log('Total Amount:', invoice.total_amount);
        console.log('Balance:', invoice.balance);

        console.log('\n--- Payments ---');
        console.log(JSON.stringify(invoice.payments, null, 2));

        console.log('\n--- Taxes & Retentions ---');
        if (invoice.taxes) console.log('Top Level Taxes:', JSON.stringify(invoice.taxes, null, 2));
        if (invoice.retentions) console.log('Top Level Retentions:', JSON.stringify(invoice.retentions, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

run();
