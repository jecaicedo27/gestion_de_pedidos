const axios = require('axios');

async function testBackendEndpoints() {
    console.log('🔍 Testing backend connectivity...\n');
    
    const endpoints = [
        { url: 'http://localhost:3001/health', name: 'Health Check' },
        { url: 'http://localhost:3001/api/siigo/connection/status', name: 'Siigo Connection Status' },
        { url: 'http://localhost:3001/api/siigo/invoices', name: 'Siigo Invoices' },
        { url: 'http://localhost:3001/api/system-config/siigo-start-date', name: 'System Config' },
        { url: 'http://localhost:3001/api/siigo/automation/status', name: 'Automation Status' }
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`Testing ${endpoint.name}...`);
            const response = await axios.get(endpoint.url, { timeout: 5000 });
            console.log(`✅ ${endpoint.name}: ${response.status} - OK`);
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${endpoint.name}: ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data) {
                    console.log(`   Error details:`, error.response.data);
                }
            } else if (error.code === 'ECONNREFUSED') {
                console.log(`❌ ${endpoint.name}: Connection refused - Server not responding`);
            } else {
                console.log(`❌ ${endpoint.name}: ${error.message}`);
            }
        }
        console.log('');
    }
    
    console.log('Testing complete.');
}

testBackendEndpoints().catch(console.error);
