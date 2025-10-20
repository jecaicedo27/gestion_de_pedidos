const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function testCustomerSearchEndpoint() {
  console.log('🧪 Testing Customer Search Endpoint for Enhanced Dropdown');
  console.log('=' * 60);

  try {
    // Test 1: Search for customers with a common term
    console.log('\n📋 Test 1: Search for customers with term "LIQUI"');
    const searchResponse = await api.get('/customers/search', {
      params: { search: 'LIQUI' }
    });
    
    console.log(`✅ Search request successful - Status: ${searchResponse.status}`);
    console.log(`📊 Found ${searchResponse.data.customers ? searchResponse.data.customers.length : 0} customers`);
    
    if (searchResponse.data.customers && searchResponse.data.customers.length > 0) {
      console.log('\n🔍 Sample customer data:');
      const sample = searchResponse.data.customers[0];
      console.log({
        id: sample.id,
        name: sample.name || sample.commercial_name,
        document: sample.document,
        identification: sample.identification
      });
    }

  } catch (error) {
    if (error.response) {
      console.log(`❌ Search request failed - Status: ${error.response.status}`);
      console.log(`📄 Response:`, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Backend not accessible');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  try {
    // Test 2: Get all customers (paginated)
    console.log('\n📋 Test 2: Get paginated customers list');
    const paginatedResponse = await api.get('/customers', {
      params: { page: 1, limit: 10 }
    });
    
    console.log(`✅ Paginated request successful - Status: ${paginatedResponse.status}`);
    console.log(`📊 Customers in response: ${paginatedResponse.data.customers ? paginatedResponse.data.customers.length : 0}`);
    console.log(`📄 Total customers: ${paginatedResponse.data.total || 'Unknown'}`);

  } catch (error) {
    if (error.response) {
      console.log(`❌ Paginated request failed - Status: ${error.response.status}`);
      console.log(`📄 Response:`, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Backend not accessible');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  try {
    // Test 3: Test empty search
    console.log('\n📋 Test 3: Test empty search term');
    const emptySearchResponse = await api.get('/customers/search', {
      params: { search: '' }
    });
    
    console.log(`✅ Empty search successful - Status: ${emptySearchResponse.status}`);
    console.log(`📊 Results: ${emptySearchResponse.data.customers ? emptySearchResponse.data.customers.length : 0} customers`);

  } catch (error) {
    if (error.response) {
      console.log(`❌ Empty search failed - Status: ${error.response.status}`);
      console.log(`📄 Response:`, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Backend not accessible');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  try {
    // Test 4: Test with document number search
    console.log('\n📋 Test 4: Search by document number');
    const docSearchResponse = await api.get('/customers/search', {
      params: { search: '123' }
    });
    
    console.log(`✅ Document search successful - Status: ${docSearchResponse.status}`);
    console.log(`📊 Found ${docSearchResponse.data.customers ? docSearchResponse.data.customers.length : 0} customers with document containing "123"`);

  } catch (error) {
    if (error.response) {
      console.log(`❌ Document search failed - Status: ${error.response.status}`);
      console.log(`📄 Response:`, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Backend not accessible');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n🏁 Customer search endpoint test completed');
}

async function testQuotationEndpoint() {
  console.log('\n🧪 Testing Quotations Endpoint for Enhanced Integration');
  console.log('=' * 60);

  try {
    // Test quotations endpoint
    console.log('\n📋 Testing quotations GET endpoint');
    const quotationsResponse = await api.get('/quotations', {
      params: { page: 1, limit: 10 }
    });
    
    console.log(`✅ Quotations request successful - Status: ${quotationsResponse.status}`);
    console.log(`📊 Quotations in response: ${quotationsResponse.data.quotations ? quotationsResponse.data.quotations.length : 0}`);

  } catch (error) {
    if (error.response) {
      console.log(`❌ Quotations request failed - Status: ${error.response.status}`);
      console.log(`📄 Response:`, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Backend not accessible');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n🏁 Quotations endpoint test completed');
}

async function runTests() {
  console.log('🚀 Starting Enhanced Dropdown Functionality Tests');
  console.log('🔧 Backend URL:', API_BASE_URL);
  console.log('⏰ Started at:', new Date().toISOString());
  
  await testCustomerSearchEndpoint();
  await testQuotationEndpoint();
  
  console.log('\n' + '=' * 60);
  console.log('✅ All enhanced dropdown functionality tests completed');
  console.log('💡 If tests pass, the dropdown should work properly in the frontend');
}

runTests().catch(console.error);
