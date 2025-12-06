const siigoService = require('../services/siigoService');
const axios = require('axios');

async function listDocumentTypes() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        console.log('Fetching document types from SIIGO...');
        const response = await axios.get(`${baseUrl}/v1/document-types?type=FV`, { headers });

        if (response.data) {
            console.log('\n=== DOCUMENT TYPES (FV) ===');
            response.data.forEach(doc => {
                console.log(`ID: ${doc.id} | Code: ${doc.code} | Name: ${doc.name} | Electronic: ${doc.electronic_type}`);
            });
        } else {
            console.log('No document types found.');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.log(error.response.data);
    }
}

listDocumentTypes();
