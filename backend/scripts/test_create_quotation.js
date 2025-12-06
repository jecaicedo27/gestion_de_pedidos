const siigoService = require('../services/siigoService');
const axios = require('axios');

async function testCreateQuotation() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        // Hardcoded valid data from user
        const quotationData = {
            document: {
                id: 15048 // ID found in actual quotations
            },
            date: new Date().toISOString().split('T')[0],
            customer: {
                identification: '555', // PECHO PELUDO
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
            observations: 'Prueba de cotización con datos reales y ID correcto'
        };

        console.log('Sending quotation data:', JSON.stringify(quotationData, null, 2));

        try {
            const response = await axios.post(`${baseUrl}/v1/quotations`, quotationData, { headers });
            console.log('Success:', response.data);
        } catch (error) {
            console.error('Error message:', error.message);
            console.error('Error status:', error.response?.status);
            console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
        }

    } catch (error) {
        console.error('General Error:', error.message);
    }
}

testCreateQuotation();
