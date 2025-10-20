const axios = require('axios');

console.log('🔍 Testing backend connectivity and key endpoints...\n');

const baseURL = 'http://localhost:3001';

const testEndpoints = [
    { method: 'GET', endpoint: '/api/health', description: 'Health check', auth: false },
    { method: 'GET', endpoint: '/api/company-config/public', description: 'Public company config', auth: false },
    { method: 'GET', endpoint: '/api/siigo/invoices', description: 'SIIGO invoices', auth: false },
    { method: 'GET', endpoint: '/api/siigo/connection/status', description: 'SIIGO connection status', auth: false },
    { method: 'GET', endpoint: '/api/siigo/automation/status', description: 'SIIGO automation status', auth: false },
    { method: 'GET', endpoint: '/api/system-config/siigo-start-date', description: 'SIIGO start date', auth: false }
];

async function testEndpoint(test) {
    try {
        console.log(`🔗 Testing: ${test.method} ${test.endpoint} - ${test.description}`);
        
        const config = {
            method: test.method.toLowerCase(),
            url: `${baseURL}${test.endpoint}`,
            timeout: 10000,
            validateStatus: function (status) {
                // Accept any status code for now to see what we get
                return true;
            }
        };

        const response = await axios(config);
        
        if (response.status >= 200 && response.status < 300) {
            console.log(`✅ Success - Status: ${response.status}`);
        } else if (response.status === 404) {
            console.log(`⚠️  Endpoint not found - Status: ${response.status}`);
        } else if (response.status >= 400 && response.status < 500) {
            console.log(`⚠️  Client error - Status: ${response.status}`);
        } else if (response.status >= 500) {
            console.log(`❌ Server error - Status: ${response.status}`);
        }
        
        return { success: true, status: response.status, endpoint: test.endpoint };
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log(`❌ Connection refused - Backend not accessible`);
            return { success: false, error: 'CONNECTION_REFUSED', endpoint: test.endpoint };
        } else if (error.code === 'ETIMEDOUT') {
            console.log(`❌ Request timeout`);
            return { success: false, error: 'TIMEOUT', endpoint: test.endpoint };
        } else {
            console.log(`❌ Error: ${error.message}`);
            return { success: false, error: error.message, endpoint: test.endpoint };
        }
    }
    
    console.log(''); // Add spacing
}

async function runTests() {
    console.log('📋 Starting backend connectivity tests...\n');
    
    const results = [];
    
    for (const test of testEndpoints) {
        const result = await testEndpoint(test);
        results.push(result);
        console.log(''); // Add spacing between tests
    }
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log('=' .repeat(50));
    
    const successful = results.filter(r => r.success && r.status >= 200 && r.status < 400);
    const notFound = results.filter(r => r.success && r.status === 404);
    const clientErrors = results.filter(r => r.success && r.status >= 400 && r.status < 500 && r.status !== 404);
    const serverErrors = results.filter(r => r.success && r.status >= 500);
    const connectionFailed = results.filter(r => !r.success);
    
    console.log(`✅ Successful responses: ${successful.length}`);
    console.log(`⚠️  Not found (404): ${notFound.length}`);
    console.log(`⚠️  Client errors: ${clientErrors.length}`);
    console.log(`❌ Server errors: ${serverErrors.length}`);
    console.log(`❌ Connection failed: ${connectionFailed.length}`);
    
    if (connectionFailed.length === 0) {
        console.log('\n🎉 Backend is accessible and responding!');
        if (successful.length > 0) {
            console.log('✅ Some endpoints are working correctly');
        }
        if (serverErrors.length > 0) {
            console.log('⚠️  Some endpoints have server errors - these need investigation');
        }
    } else {
        console.log('\n❌ Backend connectivity issues detected');
    }
    
    // Test WebSocket connection
    console.log('\n🔌 Testing WebSocket connection...');
    try {
        const WebSocket = require('ws');
        const ws = new WebSocket('ws://localhost:3000/ws');
        
        ws.on('open', () => {
            console.log('✅ WebSocket connection successful');
            ws.close();
        });
        
        ws.on('error', (error) => {
            console.log(`❌ WebSocket error: ${error.message}`);
        });
        
    } catch (error) {
        console.log(`⚠️  WebSocket test skipped: ${error.message}`);
    }
    
    // Test Socket.IO connection  
    console.log('\n🔌 Testing Socket.IO connection...');
    try {
        const response = await axios.get(`${baseURL}/socket.io/`);
        console.log('✅ Socket.IO endpoint accessible');
    } catch (error) {
        if (error.response) {
            console.log(`⚠️  Socket.IO responded with status: ${error.response.status}`);
        } else {
            console.log(`❌ Socket.IO connection failed: ${error.message}`);
        }
    }
}

// Run the tests
runTests().catch(console.error);
