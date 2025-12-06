require('dotenv').config();
const axios = require('axios');

async function debugWhatsapp() {
    let token = process.env.WAPIFY_API_TOKEN;
    const baseURL = process.env.WAPIFY_API_BASE_URL;
    const phone = '+573225983886';

    // Clean token just in case
    if (token) token = token.trim();

    console.log('Config:', {
        tokenLength: token ? token.length : 0,
        firstChar: token ? token[0] : 'N/A',
        lastChar: token ? token[token.length - 1] : 'N/A',
        baseURL,
        phone
    });

    const tests = [
        { name: 'Bearer Token', headers: { 'Authorization': `Bearer ${token}` } },
        { name: 'Raw Token', headers: { 'Authorization': token } },
        { name: 'Token Prefix', headers: { 'Authorization': `Token ${token}` } },
        { name: 'X-Api-Key', headers: { 'X-Api-Key': token } }
    ];

    for (const test of tests) {
        console.log(`\n--- Testing: ${test.name} ---`);
        try {
            const api = axios.create({
                baseURL: baseURL,
                timeout: 10000,
                headers: {
                    ...test.headers,
                    'Content-Type': 'application/json'
                }
            });

            const response = await api.post('/send-message', {
                phone: phone,
                message: `Prueba de conexión (${test.name})`,
                type: 'text'
            });

            console.log('✅ Success!');
            console.log('Status:', response.status);
            console.log('Data:', JSON.stringify(response.data, null, 2));
            return; // Stop on first success

        } catch (error) {
            console.log('❌ Failed');
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Data:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('Error:', error.message);
            }
        }
    }
}

debugWhatsapp();
