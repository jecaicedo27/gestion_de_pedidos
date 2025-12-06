const siigoService = require('../services/siigoService');
const axios = require('axios');

async function checkQuotationApproval() {
    try {
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const baseUrl = siigoService.getBaseUrl();

        // First, let's check the structure of a quotation to see if there's a status field
        console.log('Fetching a sample quotation to check structure...');
        const response = await axios.get(`${baseUrl}/v1/quotations?page_size=1`, { headers });

        if (response.data.results && response.data.results.length > 0) {
            const quotation = response.data.results[0];
            console.log('\n=== QUOTATION STRUCTURE ===');
            console.log(JSON.stringify(quotation, null, 2));

            console.log('\n=== CHECKING FOR STATUS/APPROVAL FIELDS ===');
            console.log('Has status field?', quotation.status ? 'YES: ' + quotation.status : 'NO');
            console.log('Has state field?', quotation.state ? 'YES: ' + quotation.state : 'NO');
            console.log('Has approved field?', quotation.approved ? 'YES: ' + quotation.approved : 'NO');
            console.log('Has approval_status field?', quotation.approval_status ? 'YES: ' + quotation.approval_status : 'NO');
        }

        // Now let's try to update a quotation (we'll use a test approach)
        console.log('\n\n=== CHECKING UPDATE CAPABILITIES ===');
        console.log('Attempting to understand PATCH/PUT options for quotations...');

        // Try to get documentation or schema
        try {
            const schemaResponse = await axios.options(`${baseUrl}/v1/quotations`, { headers });
            console.log('OPTIONS response:', schemaResponse.headers);
        } catch (e) {
            console.log('OPTIONS not supported');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

checkQuotationApproval();
