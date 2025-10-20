const mysql = require('mysql2/promise');
const axios = require('axios');

async function fixCategoriesAuthenticationAndCleanup() {
  console.log('🔧 Fixing Categories Authentication and Cleanup...\n');
  
  const baseURL = 'http://localhost:3001';
  let connection;
  
  try {
    // Step 1: Connect to database
    console.log('Step 1: Connecting to database...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos'
    });
    console.log('✅ Database connected');

    // Step 2: Clean fake categories from database
    console.log('\nStep 2: Cleaning fake categories from database...');
    
    // First, check what products have fake categories
    const [fakeProducts] = await connection.execute(`
      SELECT id, product_name, category, siigo_code 
      FROM products_batch 
      WHERE category LIKE '%CAFÉ GOURMET%' 
         OR category LIKE '%CAFE GOURMET%'
         OR category LIKE '%GOURMET%'
    `);
    
    console.log(`❌ Found ${fakeProducts.length} products with fake categories:`);
    fakeProducts.slice(0, 5).forEach(product => {
      console.log(`   - ${product.product_name} | Category: ${product.category} | SIIGO: ${product.siigo_code}`);
    });
    
    if (fakeProducts.length > 0) {
      // Delete or update these products
      const [updateResult] = await connection.execute(`
        UPDATE products_batch 
        SET category = NULL, 
            updated_at = NOW()
        WHERE category LIKE '%CAFÉ GOURMET%' 
           OR category LIKE '%CAFE GOURMET%'
           OR category LIKE '%GOURMET%'
      `);
      
      console.log(`✅ Cleaned ${updateResult.affectedRows} products with fake categories`);
    } else {
      console.log('✅ No fake categories found in database');
    }

    // Step 3: Test authentication flow step by step
    console.log('\nStep 3: Testing authentication flow...');
    
    let authToken;
    try {
      const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
        username: 'admin',
        password: 'admin123'
      });
      
      if (loginResponse.data.success) {
        authToken = loginResponse.data.token;
        console.log('✅ Login successful');
        console.log('🔍 Token preview:', authToken.substring(0, 20) + '...');
      } else {
        throw new Error('Login failed: ' + loginResponse.data.message);
      }
    } catch (loginError) {
      console.log('❌ Login failed:', loginError.message);
      return;
    }

    // Step 4: Test a simple authenticated endpoint first
    console.log('\nStep 4: Testing simple authenticated endpoint...');
    try {
      const testResponse = await axios.get(`${baseURL}/api/users`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (testResponse.data.success) {
        console.log('✅ Authentication working - users endpoint accessible');
      } else {
        console.log('❌ Users endpoint failed despite having token');
      }
    } catch (authTestError) {
      console.log('❌ Auth test failed:', authTestError.response?.status, authTestError.message);
      console.log('📄 Response data:', authTestError.response?.data);
      
      // Try to diagnose the issue
      if (authTestError.response?.status === 401) {
        console.log('\n🔍 Diagnosing 401 error...');
        console.log('   Token format check:', typeof authToken, authToken ? 'present' : 'missing');
        console.log('   Token length:', authToken?.length);
        console.log('   Header being sent:', `Bearer ${authToken}`.substring(0, 30) + '...');
      }
    }

    // Step 5: Check if backend has SIIGO categories routes loaded
    console.log('\nStep 5: Checking backend SIIGO categories routes...');
    try {
      // Test the live endpoint with authentication
      const siigoLiveResponse = await axios.get(`${baseURL}/api/siigo-categories/live`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (siigoLiveResponse.data.success) {
        console.log('✅ SIIGO live categories endpoint working');
        console.log('📊 Categories found:', siigoLiveResponse.data.categories.length);
        console.log('🔍 Sample categories:', siigoLiveResponse.data.categories.slice(0, 5));
      } else {
        console.log('❌ SIIGO live endpoint returned error:', siigoLiveResponse.data.message);
      }
    } catch (siigoError) {
      console.log('❌ SIIGO live endpoint failed:', siigoError.response?.status, siigoError.message);
      
      // Try local fallback
      console.log('\n🔄 Testing local categories fallback...');
      try {
        const localResponse = await axios.get(`${baseURL}/api/siigo-categories/local`, {
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (localResponse.data.success) {
          console.log('✅ Local categories fallback working');
          console.log('📂 Local categories found:', localResponse.data.categories.length);
          console.log('🔍 Sample local categories:', localResponse.data.categories.slice(0, 5));
          
          // Check if expected categories are present
          const expectedCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS'];
          const foundCategories = expectedCategories.filter(cat => 
            localResponse.data.categories.some(localCat => localCat.includes(cat))
          );
          console.log(`🎯 Expected categories found in local: ${foundCategories.length}/${expectedCategories.length}`);
          console.log('   Found:', foundCategories);
        } else {
          console.log('❌ Local categories also failed:', localResponse.data.message);
        }
      } catch (localError) {
        console.log('❌ Local categories also failed:', localError.response?.status, localError.message);
      }
    }

    // Step 6: Check current database categories after cleanup
    console.log('\nStep 6: Checking current database categories after cleanup...');
    const [categories] = await connection.execute(`
      SELECT DISTINCT category 
      FROM products_batch 
      WHERE category IS NOT NULL 
        AND category != '' 
        AND is_active = 1
      ORDER BY category
    `);
    
    const categoryList = categories.map(row => row.category);
    console.log(`📂 Current database categories: ${categoryList.length}`);
    categoryList.forEach(cat => console.log(`   - ${cat}`));
    
    // Check if fake categories still exist
    const fakeStillPresent = categoryList.filter(cat => 
      cat.includes('CAFÉ GOURMET') || 
      cat.includes('CAFE GOURMET') ||
      cat.includes('GOURMET')
    );
    
    if (fakeStillPresent.length > 0) {
      console.log('⚠️  Warning: Fake categories still present:', fakeStillPresent);
    } else {
      console.log('✅ No fake categories remaining');
    }

    console.log('\n📋 DIAGNOSIS SUMMARY:');
    console.log('======================');
    if (authToken) {
      console.log('✅ Authentication: Login working');
      console.log('❓ Token validation: Needs investigation');
    } else {
      console.log('❌ Authentication: Login failing');
    }
    console.log(`✅ Database cleanup: Fake categories ${fakeProducts.length > 0 ? 'removed' : 'not found'}`);
    console.log(`📂 Available categories: ${categoryList.length} unique categories`);
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('1. Restart backend server to ensure all routes are loaded');
    console.log('2. Check JWT token validation in backend/middleware/auth.js');
    console.log('3. Test frontend categories loading after backend restart');
    console.log('4. Verify SIIGO API credentials are correct');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🔧 Solution: Start the backend server first');
      console.log('   Run: cd backend && npm start');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('🔧 Solution: Check MySQL credentials');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the fix
fixCategoriesAuthenticationAndCleanup().catch(console.error);
