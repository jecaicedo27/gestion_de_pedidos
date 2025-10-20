const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testEndpoint(endpoint, method = 'GET', data = null, auth = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            timeout: 10000
        };
        
        if (auth) {
            config.headers = { 'Authorization': `Bearer ${auth}` };
        }
        
        if (data) {
            config.data = data;
        }
        
        console.log(`\n🔍 Testing ${method} ${endpoint}`);
        const response = await axios(config);
        console.log(`✅ Success: ${response.status} ${response.statusText}`);
        
        if (response.data) {
            console.log(`📊 Response length: ${JSON.stringify(response.data).length} characters`);
            if (typeof response.data === 'object' && response.data.length !== undefined) {
                console.log(`📝 Array items: ${response.data.length}`);
            }
        }
        
        return { success: true, status: response.status, data: response.data };
        
    } catch (error) {
        console.log(`❌ Error: ${error.response?.status || 'No Response'} - ${error.response?.statusText || error.message}`);
        
        if (error.response?.data) {
            console.log(`🔥 Error details:`, JSON.stringify(error.response.data, null, 2));
        }
        
        return { success: false, error: error.message, status: error.response?.status, data: error.response?.data };
    }
}

async function loginAndGetToken() {
    console.log('\n🔐 Attempting to login...');
    try {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        if (response.data && response.data.token) {
            console.log('✅ Login successful, token obtained');
            return response.data.token;
        }
    } catch (error) {
        console.log('❌ Login failed:', error.message);
        return null;
    }
}

async function runDiagnostics() {
    console.log('🏥 COMPREHENSIVE 500 ERROR DIAGNOSTICS');
    console.log('=====================================');
    
    // Test basic connectivity
    console.log('\n📡 CONNECTIVITY TESTS');
    await testEndpoint('/api/health');
    await testEndpoint('/api/config/public');
    
    // Get authentication token
    const token = await loginAndGetToken();
    
    if (!token) {
        console.log('\n❌ Cannot proceed with authenticated tests - login failed');
        return;
    }
    
    console.log('\n🔒 AUTHENTICATED ENDPOINTS TESTS');
    
    // Test the specific failing endpoints from the error log
    const failingEndpoints = [
        { endpoint: '/api/siigo/invoices?page=1&page_size=5', method: 'GET' },
        { endpoint: '/api/quotations/create-invoice', method: 'POST', data: { customerId: '1', items: [] } },
        { endpoint: '/api/quotations', method: 'GET' },
        { endpoint: '/api/quotations/create-siigo-invoice-with-chatgpt', method: 'POST', data: { customerId: '1', naturalLanguage: 'test order' } }
    ];
    
    console.log('\n🎯 TESTING FAILING ENDPOINTS');
    for (const test of failingEndpoints) {
        await testEndpoint(test.endpoint, test.method, test.data, token);
    }
    
    // Test related endpoints that might be affected
    console.log('\n🔄 TESTING RELATED ENDPOINTS');
    await testEndpoint('/api/quotations/customers/search?q=', 'GET', null, token);
    await testEndpoint('/api/products?page=1&limit=10', 'GET', null, token);
    await testEndpoint('/api/siigo/customers', 'GET', null, token);
    
    // Test notification system endpoint
    console.log('\n🔔 TESTING NOTIFICATION SYSTEM');
    await testEndpoint('/api/notifications/check', 'GET', null, token);
    
    console.log('\n🏁 DIAGNOSTICS COMPLETE');
    console.log('=====================================');
}

runDiagnostics().catch(error => {
    console.error('💥 Diagnostic script failed:', error);
    process.exit(1);
});
