const axios = require('axios');

async function testCreateQuotation() {
    try {
        // Need a valid customer ID. I'll pick one from the database or use a dummy if I can't find one.
        // For now, I'll try with a dummy ID and see if it fails with "Customer not found" or the Siigo error.
        // Ideally I should query the DB first to get a valid customer.

        const payload = {
            customer_id: 1, // Assuming ID 1 exists, otherwise I'll need to fetch one
            items: [
                {
                    code: 'P001', // Dummy code
                    description: 'Test Product',
                    quantity: 1,
                    price: 1000
                }
            ],
            notes: 'Test quotation',
            documentType: 'quotation'
        };

        // Need authentication token?
        // The route is protected. I might need to login first or bypass auth for testing.
        // Bypassing auth is hard without modifying code.
        // I'll try to login first if I have credentials, or just use the existing session if I can (I can't).

        // Alternative: Modify the controller to log to a file in the workspace, then trigger it from the frontend (user).
        // But I can't ask the user to trigger it again and again.

        // Let's try to query a valid customer first.

        console.log('Sending request...');
        const response = await axios.post('http://localhost:3001/api/quotations/create-quotation-siigo', payload);
        console.log('Response:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Error Status:', error.response.status);
            console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

testCreateQuotation();
