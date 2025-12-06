
require('dotenv').config();
const axios = require('axios');

async function debugWhapifyV2() {
    let token = process.env.WAPIFY_API_TOKEN;
    const baseURL = process.env.WAPIFY_API_BASE_URL || 'https://ap.whapify.ai/api';
    const phone = '3225983886'; // User's number
    const name = 'Test User';

    if (token) token = token.trim();

    console.log('Config:', {
        tokenLength: token ? token.length : 0,
        baseURL,
        phone
    });

    const api = axios.create({
        baseURL: baseURL,
        timeout: 30000,
        headers: {
            'X-ACCESS-TOKEN': token,
            'Content-Type': 'application/json'
        }
    });

    try {
        // 1. Find Contact
        console.log('\n1. Finding contact...');
        let contactId = null;

        // Format phone as service does: 57 + number if 10 digits
        const cleanPhone = '57' + phone;

        try {
            const findRes = await api.get('/contacts/find_by_custom_field', {
                params: { field_id: 'phone', value: cleanPhone }
            });
            console.log('Find response:', JSON.stringify(findRes.data, null, 2));

            if (findRes.data?.data?.length > 0) {
                contactId = findRes.data.data[0].id;
                console.log('Contact found:', contactId);
            }
        } catch (e) {
            console.log('Find error:', e.response?.data || e.message);
        }

        // 2. Create if not found
        if (!contactId) {
            console.log('\n2. Creating contact...');
            try {
                const createRes = await api.post('/contacts', {
                    phone: `+${cleanPhone}`,
                    first_name: 'Test',
                    last_name: 'User'
                });
                console.log('Create response:', JSON.stringify(createRes.data, null, 2));

                // Handle array or object return
                const created = Array.isArray(createRes.data?.data) ? createRes.data.data[0] : createRes.data?.data;
                if (created && created.id) {
                    contactId = created.id;
                    console.log('Contact created:', contactId);
                }
            } catch (e) {
                console.log('Create error:', e.response?.data || e.message);
            }
        }

        // 3. Send Message
        if (contactId) {
            console.log(`\n3. Sending message to ${contactId}...`);
            try {
                const sendRes = await api.post(`/contacts/${contactId}/send/text`, {
                    content: {
                        text: 'Prueba de conexión (Whapify V2)',
                        channel: 'whatsapp'
                    }
                });
                console.log('✅ Send success!');
                console.log('Response:', JSON.stringify(sendRes.data, null, 2));
            } catch (e) {
                console.log('❌ Send error:', e.response?.data || e.message);
            }
        } else {
            console.log('❌ Could not get Contact ID');
        }

    } catch (error) {
        console.error('Unexpected error:', error.message);
    }
}

debugWhapifyV2();
