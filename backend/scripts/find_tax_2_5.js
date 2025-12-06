const siigoService = require('../services/siigoService');
const axios = require('axios');

async function listTaxes() {
    try {
        console.log('🔐 Authenticating with Siigo...');
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        console.log('📋 Fetching taxes...');
        const response = await axios.get(`${baseUrl}/v1/taxes`, { headers });

        const taxes = response.data;

        // Filter for 2.5% taxes
        const targetTaxes = taxes.filter(t => t.percentage === 2.5);

        console.log('✅ Taxes with 2.5% found:');
        console.log(JSON.stringify(targetTaxes, null, 2));

    } catch (error) {
        console.error('❌ Error fetching taxes:', error.message);
    }
}

listTaxes();
