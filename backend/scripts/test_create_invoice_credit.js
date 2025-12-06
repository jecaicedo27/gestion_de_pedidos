const siigoInvoiceService = require('../services/siigoInvoiceService');
const siigoService = require('../services/siigoService');

async function testCreateInvoiceCredit() {
    try {
        await siigoService.authenticate();

        const customer = {
            identification: '555',
            branch_office: 0,
            name: 'PECHO PELUDO',
            person_type: 'Person',
            id_type: '13'
        };

        const items = [
            {
                code: 'IMPLE04',
                quantity: 2,
                price: 106
            }
        ];

        const notes = 'Prueba de verificación de método de pago por defecto';
        const originalRequest = 'Pedido de prueba';

        console.log('Preparing invoice data...');
        const invoiceData = await siigoInvoiceService.prepareInvoiceData(customer, items, notes, originalRequest);

        console.log('Generated Payment Method ID:', invoiceData.payments[0].id);
        console.log('Full Invoice Data:', JSON.stringify(invoiceData, null, 2));

        if (invoiceData.payments[0].id === 3467) {
            console.log('✅ SUCCESS: Default payment method is 3467 (Crédito)');
        } else {
            console.log(`❌ FAILURE: Default payment method is ${invoiceData.payments[0].id}, expected 3467`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testCreateInvoiceCredit();
