
require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function testEndpoint() {
    try {
        const response = await axios.get('http://localhost:3001/api/admin/profitability-trend', {
            params: {
                startDate: '2025-12-01',
                endDate: '2025-12-31',
                interval: 'day'
            },
            headers: {
                // Using a simple admin auth - adjust if needed
                'Authorization': 'Bearer test'
            },
            validateStatus: () => true
        });

        console.log('Status:', response.status);

        if (response.status === 200 && response.data.success) {
            const data = response.data.data;
            console.log('\nTotal data points:', data.length);

            // Filter for Dec 17-20
            const filtered = data.filter(d => d.date >= '2025-12-17' && d.date <= '2025-12-20');

            console.log('\nData for Dec 17-20:');
            console.table(filtered);
        } else {
            console.log('Response:', response.data);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testEndpoint();
