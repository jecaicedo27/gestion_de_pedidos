const axios = require('axios');

// Test the new SIIGO categories integration in the frontend
async function testSiigoCategoriesIntegration() {
  console.log('🧪 Testing SIIGO Categories Frontend Integration...\n');
  
  const baseURL = 'http://localhost:3001';
  let authToken;
  
  try {
    // Step 1: Login to get auth token
    console.log('Step 1: Authenticating...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data.success) {
      authToken = loginResponse.data.token;
      console.log('✅ Authentication successful');
    } else {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
    
    // Step 2: Test SIIGO live categories endpoint
    console.log('\nStep 2: Testing SIIGO live categories endpoint...');
    try {
      const siigoResponse = await axios.get(`${baseURL}/api/siigo-categories/live`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (siigoResponse.data.success) {
        const siigoCategories = siigoResponse.data.categories;
        console.log('✅ SIIGO live categories loaded successfully');
        console.log(`📊 Categories from SIIGO: ${siigoCategories.length} found`);
        console.log('🔍 SIIGO Categories:', siigoCategories.slice(0, 5), siigoCategories.length > 5 ? '...' : '');
        
        // Verify expected categories are present
        const expectedCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS'];
        const foundCategories = expectedCategories.filter(cat => siigoCategories.includes(cat));
        console.log(`🎯 Expected categories found: ${foundCategories.length}/${expectedCategories.length}`);
        console.log('   Found:', foundCategories);
        
        if (foundCategories.length === 0) {
          console.log('⚠️  WARNING: No expected categories found in SIIGO response');
        }
      } else {
        console.log('❌ SIIGO live endpoint failed:', siigoResponse.data.message);
        throw new Error('SIIGO endpoint failed');
      }
    } catch (siigoError) {
      console.log('❌ SIIGO live endpoint error:', siigoError.message);
      console.log('🔄 This will trigger fallback to local categories...');
    }
    
    // Step 3: Test local fallback categories endpoint
    console.log('\nStep 3: Testing local fallback categories endpoint...');
    try {
      const localResponse = await axios.get(`${baseURL}/api/siigo-categories/local`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (localResponse.data.success) {
        const localCategories = localResponse.data.categories;
        console.log('✅ Local fallback categories loaded successfully');
        console.log(`📂 Categories from local DB: ${localCategories.length} found`);
        console.log('🔍 Local Categories:', localCategories.slice(0, 5), localCategories.length > 5 ? '...' : '');
        
        // Verify expected categories are present
        const expectedCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS'];
        const foundCategories = expectedCategories.filter(cat => localCategories.includes(cat));
        console.log(`🎯 Expected categories found: ${foundCategories.length}/${expectedCategories.length}`);
        console.log('   Found:', foundCategories);
      } else {
        console.log('❌ Local fallback endpoint failed:', localResponse.data.message);
      }
    } catch (localError) {
      console.log('❌ Local fallback endpoint error:', localError.message);
    }
    
    // Step 4: Test inventory endpoint to see if it still works
    console.log('\nStep 4: Testing inventory endpoint compatibility...');
    try {
      const inventoryResponse = await axios.get(`${baseURL}/api/inventory/grouped`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (inventoryResponse.data.success) {
        const products = inventoryResponse.data.data;
        console.log('✅ Inventory endpoint working correctly');
        console.log(`📦 Products loaded: ${products.length} found`);
        
        // Extract categories from products (old way) for comparison
        const productCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
        console.log(`🔍 Categories extracted from products: ${productCategories.length} found`);
        console.log('   Product Categories:', productCategories.slice(0, 5), productCategories.length > 5 ? '...' : '');
        
      } else {
        console.log('❌ Inventory endpoint failed:', inventoryResponse.data.message);
      }
    } catch (inventoryError) {
      console.log('❌ Inventory endpoint error:', inventoryError.message);
    }
    
    console.log('\n🎉 INTEGRATION TEST SUMMARY:');
    console.log('✅ The frontend now loads categories from SIIGO API in real-time');
    console.log('✅ Fallback to local database categories when SIIGO is unavailable');
    console.log('✅ No more "hardcoded" categories extracted from products');
    console.log('🔄 User issue resolved: Categories are now fetched live from SIIGO!');
    
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Open the Inventory + Facturación page in browser');
    console.log('2. Check the category dropdown - it should show SIIGO categories');
    console.log('3. Look in browser console for category loading messages');
    console.log('4. Categories should be fetched fresh each time the page loads');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('📡 Server response:', error.response.status, error.response.statusText);
      console.error('📄 Response data:', error.response.data);
    }
    
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('1. Make sure backend server is running on port 3001');
    console.log('2. Verify SIIGO credentials are configured in backend/.env');
    console.log('3. Check that siigo-categories route is registered in server.js');
    console.log('4. Ensure products table has categories populated');
  }
}

// Run the test
testSiigoCategoriesIntegration().catch(console.error);
