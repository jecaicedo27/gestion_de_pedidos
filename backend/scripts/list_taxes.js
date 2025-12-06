const siigoService = require('../services/siigoService');
const axios = require('axios');

async function listTaxes() {
    try {
        console.log('🔐 Authenticating with Siigo...');
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        console.log('📋 Fetching taxes...');
        const response = await axios.get(`${baseUrl}/v1/taxes`, { headers });

        console.log('✅ Taxes found:');
        const taxes = response.data;

        // Filter for Retención en la Fuente related taxes
        const retefuenteTaxes = taxes.filter(t =>
            t.name.toLowerCase().includes('retefuente') ||
            t.name.toLowerCase().includes('retencion') ||
            t.type === 'ReteFuente'
        );

        console.log(JSON.stringify(retefuenteTaxes, null, 2));

        console.log('--- All Taxes Summary ---');
        taxes.forEach(t => {
            console.log(`ID: ${t.id} | Name: ${t.name} | Type: ${t.type} | Percentage: ${t.percentage}`);
        });

    } catch (error) {
        console.error('❌ Error fetching taxes:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

listTaxes();
