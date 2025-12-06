
require('dotenv').config();
const siigoService = require('./services/siigoService');

async function run() {
    try {
        const invoiceId = '1f9588ab-929d-4109-8352-552de19eba78';
        console.log(`Fetching invoice details for ID: ${invoiceId}`);
        const invoice = await siigoService.getInvoiceDetails(invoiceId);

        console.log('Total:', invoice.total);
        console.log('Total Amount:', invoice.total_amount);
        console.log('Balance:', invoice.balance);
        console.log('Payments:', JSON.stringify(invoice.payments, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

run();
