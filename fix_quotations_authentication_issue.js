const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const BASE_URL = 'http://localhost:3001/api';

async function debugAuthentication() {
  try {
    console.log('🔍 Deep debugging authentication issue...\n');
    
    // Step 1: Test login and get token details
    console.log('Step 1: Testing authentication...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('Token length:', token.length);
    console.log('Token starts with:', token.substring(0, 20) + '...');
    
    // Step 2: Test different header formats
    console.log('\nStep 2: Testing different authentication header formats...');
    
    // Test 1: Standard Bearer format
    try {
      const response1 = await axios.get(`${BASE_URL}/quotations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Bearer format works');
    } catch (error) {
      console.log('❌ Bearer format failed:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 2: Without Bearer prefix
    try {
      const response2 = await axios.get(`${BASE_URL}/quotations`, {
        headers: {
          'Authorization': token
        }
      });
      console.log('✅ Direct token works');
    } catch (error) {
      console.log('❌ Direct token failed:', error.response?.status, error.response?.data?.message);
    }
    
    // Step 3: Test token verification endpoint
    console.log('\nStep 3: Testing auth verification...');
    try {
      const verifyResponse = await axios.get(`${BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Auth verify works:', verifyResponse.data);
    } catch (error) {
      console.log('❌ Auth verify failed:', error.response?.status, error.response?.data);
    }
    
    // Step 4: Compare with working Siigo endpoint
    console.log('\nStep 4: Testing working Siigo endpoint...');
    try {
      const siigoResponse = await axios.get(`${BASE_URL}/siigo/invoices?page=1&page_size=1`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Siigo endpoint works - returns', siigoResponse.data?.data?.results?.length || 0, 'invoices');
    } catch (error) {
      console.log('❌ Siigo endpoint failed:', error.response?.status, error.response?.data?.message);
    }
    
    // Step 5: Check JWT token details
    console.log('\nStep 5: Analyzing JWT token...');
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      console.log('Token payload:', JSON.stringify(decoded, null, 2));
    } catch (error) {
      console.log('❌ Could not decode token:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugAuthentication();
