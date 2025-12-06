
require('dotenv').config();
const siigoService = require('./services/siigoService');

async function run() {
    try {
        const invoiceId = 'f7464ecd-3d74-41ef-b179-0643500cb860';
        console.log(`Fetching invoice details for ID: ${invoiceId}`);
        const fullInvoice = await siigoService.getInvoiceDetails(invoiceId);

        const calculateTotal = (invoice, fullInvoice) => {
            // Prioridad 1: Total de la factura completa
            if (fullInvoice.total && !isNaN(parseFloat(fullInvoice.total))) {
                console.log('Using fullInvoice.total:', fullInvoice.total);
                return parseFloat(fullInvoice.total);
            }

            // Prioridad 2: Total amount de la factura completa
            if (fullInvoice.total_amount && !isNaN(parseFloat(fullInvoice.total_amount))) {
                console.log('Using fullInvoice.total_amount:', fullInvoice.total_amount);
                return parseFloat(fullInvoice.total_amount);
            }

            // Prioridad 3: Total de la factura básica
            if (invoice.total && !isNaN(parseFloat(invoice.total))) {
                console.log('Using invoice.total:', invoice.total);
                return parseFloat(invoice.total);
            }

            // Prioridad 4: Total amount de la factura básica
            if (invoice.total_amount && !isNaN(parseFloat(invoice.total_amount))) {
                console.log('Using invoice.total_amount:', invoice.total_amount);
                return parseFloat(invoice.total_amount);
            }

            // Prioridad 5: Calcular desde items si existen
            if (fullInvoice.items && Array.isArray(fullInvoice.items)) {
                console.log('Calculating from items...');
                const calculatedTotal = fullInvoice.items.reduce((sum, item) => {
                    const quantity = parseFloat(item.quantity || 1);
                    const price = parseFloat(item.unit_price || item.price || 0);
                    return sum + (quantity * price);
                }, 0);

                if (calculatedTotal > 0) return calculatedTotal;
            }

            return 0;
        };

        const total = calculateTotal(fullInvoice, fullInvoice);
        console.log('Calculated Total:', total);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

run();
