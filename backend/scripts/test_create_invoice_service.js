const siigoInvoiceService = require('../services/siigoInvoiceService');
const siigoService = require('../services/siigoService');

async function testCreateInvoiceService() {
    try {
        await siigoService.authenticate();

        const invoiceData = {
            document: {
                id: 27081 // ID found in actual invoices
            },
            date: new Date().toISOString().split('T')[0],
            customer: {
                identification: '555',
                branch_office: 0,
                name: ['PECHO', 'PELUDO'],
                person_type: 'Person',
                id_type: '13'
            },
            seller: 388,
            items: [
                {
                    code: 'IMPLE04',
                    quantity: 2,
                    price: 106
                }
            ],
            payments: [
                {
                    id: 3466,
                    value: 212,
                    due_date: new Date().toISOString().split('T')[0]
                }
            ],
            observations: 'Prueba de factura desde script servicio'
        };

        console.log('Creating invoice via service...');
        const result = await siigoInvoiceService.createInvoice(invoiceData);
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testCreateInvoiceService();
