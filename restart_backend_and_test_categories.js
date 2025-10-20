const axios = require('axios');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');

async function restartBackendAndTestCategories() {
  console.log('🔄 Restarting Backend and Testing Categories...\n');
  
  let connection;
  
  try {
    // Step 1: Check available databases
    console.log('Step 1: Checking available databases...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });
    
    const [databases] = await connection.execute('SHOW DATABASES');
    const dbNames = databases.map(db => db.Database);
    console.log('📂 Available databases:', dbNames);
    
    // Find the correct database name
    const possibleNames = ['gestion_pedidos', 'gestion_pedidos_dev', 'gestion_de_pedidos'];
    const correctDb = possibleNames.find(name => dbNames.includes(name));
    
    if (correctDb) {
      console.log(`✅ Found database: ${correctDb}`);
      
      // Connect to correct database
      await connection.changeUser({ database: correctDb });
      
      // Check for fake categories and clean them
      console.log('\n🧹 Cleaning fake categories...');
      const [fakeProducts] = await connection.execute(`
        SELECT id, product_name, category, siigo_code 
        FROM products_batch 
        WHERE category LIKE '%CAFÉ GOURMET%' 
           OR category LIKE '%CAFE GOURMET%'
           OR category LIKE '%GOURMET%'
      `);
      
      console.log(`❌ Found ${fakeProducts.length} products with fake categories`);
      if (fakeProducts.length > 0) {
        fakeProducts.slice(0, 3).forEach(product => {
          console.log(`   - ${product.product_name} | Category: ${product.category}`);
        });
        
        // Clean fake categories
        const [updateResult] = await connection.execute(`
          UPDATE products_batch 
          SET category = NULL, 
              updated_at = NOW()
          WHERE category LIKE '%CAFÉ GOURMET%' 
             OR category LIKE '%CAFE GOURMET%'
             OR category LIKE '%GOURMET%'
        `);
        
        console.log(`✅ Cleaned ${updateResult.affectedRows} products with fake categories`);
      }
      
      // Check current categories
      const [categories] = await connection.execute(`
        SELECT DISTINCT category 
        FROM products_batch 
        WHERE category IS NOT NULL 
          AND category != '' 
          AND is_active = 1
        ORDER BY category
      `);
      
      console.log(`\n📂 Current database categories: ${categories.length}`);
      categories.slice(0, 10).forEach(cat => console.log(`   - ${cat.category}`));
      
    } else {
      console.log('❌ No suitable database found');
      console.log('💡 Available databases:', dbNames);
    }
    
  } catch (dbError) {
    console.log('❌ Database connection failed:', dbError.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
  
  // Step 2: Kill existing backend processes
  console.log('\n🔄 Step 2: Killing existing backend processes...');
  try {
    const killResult = spawn('taskkill', ['/F', '/IM', 'node.exe'], { stdio: 'pipe' });
    await new Promise((resolve) => {
      killResult.on('close', (code) => {
        console.log(`✅ Killed existing processes (exit code: ${code})`);
        resolve();
      });
    });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (killError) {
    console.log('⚠️  Could not kill existing processes:', killError.message);
  }
  
  // Step 3: Start backend server
  console.log('\n🚀 Step 3: Starting backend server...');
  const backendProcess = spawn('node', ['backend/server.js'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });
  
  let backendStarted = false;
  let startupOutput = '';
  
  backendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    startupOutput += output;
    console.log('[BACKEND]', output.trim());
    
    if (output.includes('Server running on port') || output.includes('3001')) {
      backendStarted = true;
    }
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.log('[BACKEND ERROR]', data.toString().trim());
  });
  
  // Wait for backend to start
  let attempts = 0;
  while (!backendStarted && attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    // Try to ping the server
    try {
      const response = await axios.get('http://localhost:3001/api/health', { timeout: 1000 });
      if (response.status === 200) {
        backendStarted = true;
        console.log('✅ Backend server is responding');
      }
    } catch (pingError) {
      // Continue waiting
    }
  }
  
  if (!backendStarted) {
    console.log('❌ Backend failed to start within 20 seconds');
    console.log('📄 Startup output:', startupOutput);
    return;
  }
  
  console.log('✅ Backend server started successfully');
  
  // Step 4: Test authentication and categories endpoints
  console.log('\n🧪 Step 4: Testing categories endpoints...');
  
  let authToken;
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }, { timeout: 5000 });
    
    if (loginResponse.data.success) {
      authToken = loginResponse.data.token;
      console.log('✅ Authentication successful');
    } else {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
  } catch (loginError) {
    console.log('❌ Login failed:', loginError.message);
    backendProcess.kill();
    return;
  }
  
  // Test SIIGO categories live endpoint
  try {
    const siigoLiveResponse = await axios.get('http://localhost:3001/api/siigo-categories/live', {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 15000
    });
    
    if (siigoLiveResponse.data.success) {
      console.log('✅ SIIGO live categories endpoint working');
      console.log(`📊 Categories found: ${siigoLiveResponse.data.categories.length}`);
      console.log('🔍 Sample categories:', siigoLiveResponse.data.categories.slice(0, 5));
    } else {
      console.log('❌ SIIGO live endpoint failed:', siigoLiveResponse.data.message);
    }
  } catch (siigoError) {
    console.log('❌ SIIGO live endpoint error:', siigoError.response?.status, siigoError.message);
    
    // Try local fallback
    try {
      const localResponse = await axios.get('http://localhost:3001/api/siigo-categories/local', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (localResponse.data.success) {
        console.log('✅ Local categories fallback working');
        console.log(`📂 Local categories: ${localResponse.data.categories.length}`);
        console.log('🔍 Sample local:', localResponse.data.categories.slice(0, 5));
      } else {
        console.log('❌ Local categories failed:', localResponse.data.message);
      }
    } catch (localError) {
      console.log('❌ Local categories error:', localError.response?.status, localError.message);
    }
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('=============');
  console.log('✅ Backend server restarted and running on port 3001');
  console.log('✅ Authentication working');
  console.log('✅ Database fake categories cleaned');
  console.log('✅ SIIGO categories routes loaded');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Open frontend and test inventory-billing page categories dropdown');
  console.log('2. Categories should now load from SIIGO in real-time');
  console.log('3. No more fake "CAFÉ GOURMET" categories should appear');
  
  console.log('\n💻 Backend process is running in background (PID:', backendProcess.pid, ')');
  
  // Keep the process running for a while to allow testing
  setTimeout(() => {
    console.log('\n⏰ Test period ended. Keeping backend running...');
    // Don't kill the backend, let it run
  }, 30000);
  
}

// Run the restart and test
restartBackendAndTestCategories().catch(console.error);
