const axios = require('axios');

async function debugCategoriesLoadingIssue() {
  console.log('🔍 Debugging Categories Loading Issue...\n');
  
  const baseURL = 'http://localhost:3001';
  let authToken;
  
  try {
    // Step 1: Login to get auth token
    console.log('Step 1: Authenticating...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data.success) {
      authToken = loginResponse.data.token;
      console.log('✅ Authentication successful');
    } else {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
    
    // Step 2: Test current categories in dropdown (what frontend sees)
    console.log('\nStep 2: Testing current inventory endpoint...');
    const inventoryResponse = await axios.get(`${baseURL}/api/inventory/grouped`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (inventoryResponse.data.success) {
      const products = inventoryResponse.data.data;
      console.log(`📦 Products loaded: ${products.length}`);
      
      // Extract categories from products (old way)
      const productCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
      console.log(`📂 Categories from products (current way): ${productCategories.length}`);
      console.log('   Categories:', productCategories);
      
      // Check for fake categories
      const suspiciousCategories = productCategories.filter(cat => 
        cat.includes('CAFÉ GOURMET') || 
        cat.includes('CAFE GOURMET') ||
        cat.includes('GOURMET')
      );
      
      if (suspiciousCategories.length > 0) {
        console.log('⚠️  FAKE CATEGORIES FOUND:', suspiciousCategories);
      }
      
    } else {
      console.log('❌ Inventory endpoint failed');
    }
    
    // Step 3: Test SIIGO categories endpoints
    console.log('\nStep 3: Testing SIIGO categories live endpoint...');
    try {
      const siigoResponse = await axios.get(`${baseURL}/api/siigo-categories/live`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (siigoResponse.data.success) {
        const siigoCategories = siigoResponse.data.categories;
        console.log('✅ SIIGO live categories loaded');
        console.log(`📊 SIIGO Categories count: ${siigoCategories.length}`);
        console.log('🔍 SIIGO Categories:', siigoCategories);
        
        // Check if expected categories are present
        const expectedCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS'];
        const foundCategories = expectedCategories.filter(cat => siigoCategories.includes(cat));
        console.log(`🎯 Expected categories found: ${foundCategories.length}/${expectedCategories.length}`);
        
        if (foundCategories.length === 0) {
          console.log('❌ NO EXPECTED CATEGORIES FOUND IN SIIGO!');
        }
      } else {
        console.log('❌ SIIGO endpoint failed:', siigoResponse.data.message);
      }
    } catch (siigoError) {
      console.log('❌ SIIGO endpoint error:', siigoError.response?.status, siigoError.message);
    }
    
    // Step 4: Test local categories fallback
    console.log('\nStep 4: Testing local categories fallback...');
    try {
      const localResponse = await axios.get(`${baseURL}/api/siigo-categories/local`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (localResponse.data.success) {
        const localCategories = localResponse.data.categories;
        console.log('✅ Local categories loaded');
        console.log(`📂 Local Categories count: ${localCategories.length}`);
        console.log('🔍 Local Categories:', localCategories);
        
        // Check for fake categories in local
        const fakeLocal = localCategories.filter(cat => 
          cat.includes('CAFÉ GOURMET') || 
          cat.includes('CAFE GOURMET') ||
          cat.includes('GOURMET')
        );
        
        if (fakeLocal.length > 0) {
          console.log('⚠️  FAKE CATEGORIES IN LOCAL DATABASE:', fakeLocal);
        }
        
      } else {
        console.log('❌ Local categories failed:', localResponse.data.message);
      }
    } catch (localError) {
      console.log('❌ Local categories error:', localError.response?.status, localError.message);
    }
    
    // Step 5: Check database directly
    console.log('\nStep 5: Direct database analysis...');
    
    // First, check what products have fake categories
    console.log('\n🔍 Analyzing products with fake categories...');
    const fakeProducts = inventoryResponse.data.data.filter(p => 
      p.category && (
        p.category.includes('CAFÉ GOURMET') || 
        p.category.includes('CAFE GOURMET') ||
        p.category.includes('GOURMET')
      )
    );
    
    console.log(`❌ Products with fake categories: ${fakeProducts.length}`);
    fakeProducts.slice(0, 5).forEach(product => {
      console.log(`   - ${product.product_name} | Category: ${product.category}`);
    });
    
    console.log('\n📋 DIAGNOSIS SUMMARY:');
    console.log('======================');
    console.log('1. Categories not showing in dropdown - need to check frontend loading');
    console.log('2. Fake "CAFÉ GOURMET" category detected in database');
    console.log('3. Need to clean fake categories from database');
    console.log('4. Need to verify SIIGO categories endpoint is working');
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('1. Clean fake categories from database');
    console.log('2. Verify backend server is running with new routes');
    console.log('3. Check browser console for frontend errors');
    console.log('4. Test SIIGO authentication and API response');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    
    if (error.response) {
      console.error('📡 Server response:', error.response.status);
      console.error('📄 Error data:', error.response.data);
    }
  }
}

// Run the debug
debugCategoriesLoadingIssue().catch(console.error);
