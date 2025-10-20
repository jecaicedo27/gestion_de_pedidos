const { spawn } = require('child_process');
const axios = require('axios');

async function startBothServices() {
  console.log('🚀 Starting Both Backend and Frontend Services...\n');
  
  // Step 1: Kill any existing processes
  console.log('Step 1: Cleaning up existing processes...');
  try {
    const killCmd = spawn('taskkill', ['/F', '/IM', 'node.exe'], { stdio: 'inherit' });
    await new Promise(resolve => killCmd.on('close', resolve));
    console.log('✅ Existing processes cleaned up');
  } catch (error) {
    console.log('⚠️  No existing processes to clean up');
  }
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 2: Start Backend Server (Port 3001)
  console.log('\nStep 2: Starting Backend Server (Port 3001)...');
  const backendProcess = spawn('node', ['backend/server.js'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let backendStarted = false;
  
  backendProcess.stdout.on('data', (data) => {
    const output = data.toString();
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
  while (!backendStarted && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    try {
      const response = await axios.get('http://localhost:3001/api/health', { timeout: 1000 });
      if (response.status === 200) {
        backendStarted = true;
      }
    } catch (error) {
      // Continue waiting
    }
  }
  
  if (!backendStarted) {
    console.log('❌ Backend failed to start. Trying alternative method...');
    
    // Try starting with cd command
    const backendProcessAlt = spawn('cmd', ['/c', 'cd backend && npm start'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    backendProcessAlt.stdout.on('data', (data) => {
      console.log('[BACKEND ALT]', data.toString().trim());
    });
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else {
    console.log('✅ Backend server started successfully on port 3001');
  }
  
  // Step 3: Start Frontend Server (Port 3000)
  console.log('\nStep 3: Starting Frontend Server (Port 3000)...');
  const frontendProcess = spawn('npm', ['start'], {
    cwd: 'frontend',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  
  let frontendStarted = false;
  
  frontendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[FRONTEND]', output.trim());
    
    if (output.includes('webpack compiled') || 
        output.includes('Local:') || 
        output.includes('localhost:3000') ||
        output.includes('development server')) {
      frontendStarted = true;
    }
  });
  
  frontendProcess.stderr.on('data', (data) => {
    console.log('[FRONTEND ERROR]', data.toString().trim());
  });
  
  // Wait for frontend to start
  attempts = 0;
  while (!frontendStarted && attempts < 60) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    try {
      const response = await axios.get('http://localhost:3000', { timeout: 1000 });
      if (response.status === 200) {
        frontendStarted = true;
      }
    } catch (error) {
      // Continue waiting
    }
  }
  
  if (!frontendStarted) {
    console.log('❌ Frontend may still be starting. Check console output above.');
  } else {
    console.log('✅ Frontend server started successfully on port 3000');
  }
  
  // Step 4: Test Backend API
  console.log('\nStep 4: Testing Backend API...');
  try {
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data.success) {
      console.log('✅ Backend API is working - authentication successful');
      
      const token = loginResponse.data.token;
      
      // Test SIIGO categories endpoint
      try {
        const categoriesResponse = await axios.get('http://localhost:3001/api/siigo-categories/local', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (categoriesResponse.data.success) {
          console.log('✅ SIIGO categories endpoint working');
          console.log(`📂 Categories available: ${categoriesResponse.data.categories.length}`);
        }
      } catch (catError) {
        console.log('⚠️  SIIGO categories endpoint needs attention');
      }
    }
  } catch (apiError) {
    console.log('⚠️  Backend API needs more time to start up');
  }
  
  console.log('\n🎉 SERVICES STATUS:');
  console.log('===================');
  console.log('🔙 Backend (Port 3001):', backendStarted ? '✅ Running' : '⚠️  Starting/Check logs');
  console.log('🌐 Frontend (Port 3000):', frontendStarted ? '✅ Running' : '⚠️  Starting/Check logs');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Open browser and go to: http://localhost:3000/inventory-billing');
  console.log('2. Login with admin/admin123');
  console.log('3. Test the categories dropdown - should now load from SIIGO in real-time');
  console.log('4. No more fake "CAFÉ GOURMET" categories should appear');
  
  console.log('\n💻 Both processes are running in background');
  console.log('   Backend PID:', backendProcess.pid);
  console.log('   Frontend PID:', frontendProcess.pid);
  
  // Keep processes alive
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down both services...');
    backendProcess.kill();
    frontendProcess.kill();
    process.exit();
  });
  
  // Keep the script running
  console.log('\n⌛ Services running... Press Ctrl+C to stop both services');
}

startBothServices().catch(console.error);
