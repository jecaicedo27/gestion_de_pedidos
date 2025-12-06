const siigoService = require('../services/siigoService');
const axios = require('axios');

async function listPaymentTypes() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        console.log('Listing payment types...');
        const response = await axios.get(`${baseUrl}/v1/payment-types?document_type=FV`, { headers });
        console.log('Payment Types:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.log(error.response.data);
    }
}

listPaymentTypes();
