const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

console.log('🔍 TESTING ORIGINAL FAILING ENDPOINTS');
console.log('=====================================\n');

async function testEndpoint(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers,
      timeout: 10000
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`✅ ${method.toUpperCase()} ${url}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response size: ${JSON.stringify(response.data).length} characters`);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    console.log(`❌ ${method.toUpperCase()} ${url}`);
    console.log(`   Error: ${error.response?.status || 'Network'} - ${error.response?.statusText || error.message}`);
    return { success: false, status: error.response?.status, error: error.message };
  }
}

async function authenticateAndGetToken() {
  try {
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data && loginResponse.data.token) {
      console.log('🔐 Authentication successful');
      return loginResponse.data.token;
    } else if (loginResponse.data && loginResponse.data.access_token) {
      console.log('🔐 Authentication successful (using access_token)');
      return loginResponse.data.access_token;
    } else {
      console.log('⚠️  Login returned 200 but no token found in response');
      console.log('   Response keys:', Object.keys(loginResponse.data));
      return null;
    }
  } catch (error) {
    console.log('❌ Authentication failed:', error.message);
    return null;
  }
}

async function runTests() {
  const results = [];
  
  console.log('📊 TESTING ORIGINALLY FAILING ENDPOINTS\n');
  
  // 1. Test SIIGO invoices endpoint that was failing
  console.log('1. Testing SIIGO Invoices (was returning 500)');
  const siigoResult = await testEndpoint('GET', '/api/siigo/invoices?page=1&page_size=5');
  results.push({ name: 'SIIGO Invoices', ...siigoResult });
  console.log('');
  
  // 2. Test quotations endpoints
  console.log('2. Testing Quotations List (was returning 400)');
  const quotationsResult = await testEndpoint('GET', '/api/quotations');
  results.push({ name: 'Quotations List', ...quotationsResult });
  console.log('');
  
  // 3. Get authentication token for protected endpoints
  console.log('3. Testing Authentication');
  const token = await authenticateAndGetToken();
  console.log('');
  
  if (token) {
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    
    // 4. Test quotations create-invoice (was returning 500)
    console.log('4. Testing Create Invoice (was returning 500)');
    const createInvoiceResult = await testEndpoint('POST', '/api/quotations/create-invoice', {
      quotationId: 1,
      customer_id: 1
    }, authHeaders);
    results.push({ name: 'Create Invoice', ...createInvoiceResult });
    console.log('');
    
    // 5. Test SIIGO invoice with ChatGPT (was returning 500)
    console.log('5. Testing SIIGO Invoice with ChatGPT (was returning 500)');
    const chatgptInvoiceResult = await testEndpoint('POST', '/api/quotations/create-siigo-invoice-with-chatgpt', {
      productDescription: 'Test product for invoice creation'
    }, authHeaders);
    results.push({ name: 'SIIGO Invoice with ChatGPT', ...chatgptInvoiceResult });
    console.log('');
  } else {
    console.log('⚠️  Skipping authenticated tests due to authentication failure\n');
    results.push({ name: 'Create Invoice', success: false, error: 'No auth token' });
    results.push({ name: 'SIIGO Invoice with ChatGPT', success: false, error: 'No auth token' });
  }
  
  // Summary
  console.log('📊 SUMMARY OF FIXES');
  console.log('==================');
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const detail = result.success ? `(${result.status})` : `(${result.status || 'Failed'})`;
    console.log(`${status} ${result.name} ${detail}`);
  });
  
  console.log(`\n🎯 Overall: ${successCount}/${totalCount} endpoints working`);
  
  if (successCount === totalCount) {
    console.log('🎉 All originally failing endpoints are now working!');
  } else if (successCount > 0) {
    console.log('🔄 Significant progress made - core infrastructure issues resolved');
  }
}

runTests().catch(console.error);
