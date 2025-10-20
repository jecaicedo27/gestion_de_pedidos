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
        
        if (response.data && typeof response.data === 'object') {
            if (response.data.length !== undefined) {
                console.log(`📊 Array items: ${response.data.length}`);
            } else if (response.data.data) {
                console.log(`📊 Has data field: ${Object.keys(response.data.data).length} properties`);
            }
        }
        
        return { success: true, status: response.status, data: response.data };
        
    } catch (error) {
        console.log(`❌ Error: ${error.response?.status || 'CONNECTION_FAILED'} - ${error.response?.statusText || error.message}`);
        return { success: false, error: error.message, status: error.response?.status };
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
        } else {
            console.log('❌ Login failed: No token received');
            return null;
        }
    } catch (error) {
        console.log(`❌ Login failed: ${error.response?.status} - ${error.message}`);
        return null;
    }
}

async function runComprehensiveTest() {
    console.log('🚀 COMPREHENSIVE 500 ERROR FIXES TEST');
    console.log('=====================================');
    console.log('Testing all previously failing endpoints...\n');
    
    let successCount = 0;
    let totalTests = 0;
    
    // Test 1: Health check
    console.log('\n📊 BASIC CONNECTIVITY TESTS');
    totalTests++;
    const healthTest = await testEndpoint('/api/health');
    if (healthTest.success) successCount++;
    
    // Test 2: Config endpoint (was 404)
    totalTests++;
    const configTest = await testEndpoint('/api/config/public');
    if (configTest.success) successCount++;
    
    // Test 3: Authentication
    console.log('\n🔒 AUTHENTICATION TEST');
    const token = await loginAndGetToken();
    
    if (!token) {
        console.log('\n❌ Cannot continue with authenticated tests - authentication failed');
        console.log(`\n📊 Final Results: ${successCount}/${totalTests} tests passed`);
        return;
    }
    
    // Test 4-7: Previously failing SIIGO endpoints
    console.log('\n🎯 TESTING PREVIOUSLY FAILING SIIGO ENDPOINTS');
    
    totalTests++;
    const siigoInvoicesTest = await testEndpoint('/api/siigo/invoices?page=1&page_size=5', 'GET', null, token);
    if (siigoInvoicesTest.success) successCount++;
    
    // Test 5-8: Quotations endpoints that were failing
    console.log('\n📋 TESTING QUOTATIONS ENDPOINTS');
    
    totalTests++;
    const quotationsTest = await testEndpoint('/api/quotations', 'GET', null, token);
    if (quotationsTest.success) successCount++;
    
    totalTests++;
    const quotationsCustomersTest = await testEndpoint('/api/quotations/customers/search?q=', 'GET', null, token);
    if (quotationsCustomersTest.success) successCount++;
    
    // Test ChatGPT endpoint (was causing 500 errors)
    totalTests++;
    const chatgptTest = await testEndpoint('/api/quotations/process-natural-order', 'POST', {
        customerId: '1',
        naturalLanguage: 'test order'
    }, token);
    if (chatgptTest.success) successCount++;
    
    // Test invoice creation endpoints
    totalTests++;
    const invoiceCreateTest = await testEndpoint('/api/quotations/create-siigo-invoice-with-chatgpt', 'POST', {
        customerId: '1',
        naturalLanguage: 'test invoice'
    }, token);
    if (invoiceCreateTest.success) successCount++;
    
    // Test additional critical endpoints
    console.log('\n🔧 TESTING OTHER CRITICAL ENDPOINTS');
    
    totalTests++;
    const productsTest = await testEndpoint('/api/products?page=1&limit=10', 'GET', null, token);
    if (productsTest.success) successCount++;
    
    totalTests++;
    const customersTest = await testEndpoint('/api/customers?page=1&limit=5', 'GET', null, token);
    if (customersTest.success) successCount++;
    
    console.log('\n📊 FINAL TEST RESULTS');
    console.log('=====================');
    console.log(`✅ Passed: ${successCount}/${totalTests} tests`);
    console.log(`❌ Failed: ${totalTests - successCount}/${totalTests} tests`);
    
    const successRate = Math.round((successCount / totalTests) * 100);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (successRate >= 80) {
        console.log('\n🎉 EXCELLENT! Most 500 errors have been resolved!');
    } else if (successRate >= 60) {
        console.log('\n✅ GOOD! Significant improvements made to 500 errors.');
    } else {
        console.log('\n⚠️  NEEDS WORK: Some 500 errors still persist.');
    }
    
    console.log('\n🏁 Testing complete!');
}

runComprehensiveTest().catch(error => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
});
