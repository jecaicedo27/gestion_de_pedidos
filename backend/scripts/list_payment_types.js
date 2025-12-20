require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const siigoService = require('../services/siigoService');

async function listPaymentTypes() {
    try {
        console.log('Obteniendo tipos de pago de SIIGO...');
        const headers = await siigoService.getHeaders();

        const response = await axios.get(`${siigoService.getBaseUrl()}/v1/payment-types?document_type=FV`, { headers });

        console.log('Tipos de pago encontrados:');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Detalles:', error.response.data);
        }
    }
}

listPaymentTypes();
