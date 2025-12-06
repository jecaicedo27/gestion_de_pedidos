
const siigoService = require('../services/siigoService');
const axios = require('axios');

async function listWarehouses() {
    try {
        console.log('Authenticating with Siigo...');
        const token = await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        console.log('Fetching warehouses...');
        const response = await axios.get(`${baseUrl}/v1/warehouses`, { headers });

        console.log('Response data:', JSON.stringify(response.data, null, 2));

        const warehouses = response.data.results || response.data;
        if (Array.isArray(warehouses)) {
            console.log('All Warehouses:', warehouses.map(w => `${w.id}: ${w.name} (Active: ${w.active})`).join('\n'));
        }
    } catch (error) {
        console.error('Error fetching warehouses:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

listWarehouses();
