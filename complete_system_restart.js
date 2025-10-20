const { spawn } = require('child_process');
const axios = require('axios');

async function completeSystemRestart() {
  console.log('🔄 COMPLETE SYSTEM RESTART');
  console.log('==========================\n');
  
  // Step 1: Kill ALL Node.js processes
  console.log('Step 1: Killing all Node.js processes...');
  try {
    await killAllNodeProcesses();
    console.log('✅ All Node.js processes killed');
  } catch (error) {
    console.log('⚠️  No Node.js processes to kill');
  }
  
  // Step 2: Check and free ports
  console.log('\nStep 2: Checking ports...');
  await checkAndFreePorts();
  
  // Step 3: Start Backend with detailed logging
  console.log('\nStep 3: Starting Backend Server (Detailed)...');
  const backendStarted = await startBackendServer();
  
  if (!backendStarted) {
    console.log('❌ Backend failed to start. Trying alternative methods...');
    await tryAlternativeBackendStart();
  }
  
  // Step 4: Start Frontend with detailed logging  
  console.log('\nStep 4: Starting Frontend Server (Detailed)...');
  const frontendStarted = await startFrontendServer();
  
  if (!frontendStarted) {
    console.log('❌ Frontend failed to start. Trying alternative methods...');
    await tryAlternativeFrontendStart();
  }
  
  // Step 5: Final verification
  console.log('\nStep 5: Final verification...');
  await finalVerification();
  
  console.log('\n🎉 COMPLETE RESTART FINISHED');
  console.log('=============================');
  console.log('📍 Frontend: http://localhost:3000/inventory-billing');
  console.log('📍 Backend API: http://localhost:3001/api/health');
  console.log('🔑 Login: admin/admin123');
  console.log('\n💡 The system should now be fully operational with SIIGO categories loading!');
}

async function killAllNodeProcesses() {
  return new Promise((resolve, reject) => {
    const killCmd = spawn('taskkill', ['/F', '/IM', 'node.exe'], { stdio: 'pipe' });
    killCmd.on('close', (code) => {
      resolve();
    });
    killCmd.on('error', reject);
  });
}

async function checkAndFreePorts() {
  const ports = [3000, 3001];
  
  for (const port of ports) {
    console.log(`🔍 Checking port ${port}...`);
    
    try {
      // Try to find process using the port
      const netstatCmd = spawn('netstat', ['-ano'], { stdio: 'pipe' });
      let output = '';
      
      netstatCmd.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise(resolve => netstatCmd.on('close', resolve));
      
      const lines = output.split('\n');
      const portLine = lines.find(line => line.includes(`:${port} `));
      
      if (portLine) {
        console.log(`⚠️  Port ${port} is in use`);
        const pid = portLine.trim().split(/\s+/).pop();
        if (pid && pid !== '0') {
          console.log(`🔫 Killing process ${pid} using port ${port}...`);
          try {
            await new Promise(resolve => {
              const killCmd = spawn('taskkill', ['/F', '/PID', pid], { stdio: 'pipe' });
              killCmd.on('close', resolve);
            });
            console.log(`✅ Freed port ${port}`);
          } catch (error) {
            console.log(`⚠️  Could not kill process ${pid}`);
          }
        }
      } else {
        console.log(`✅ Port ${port} is free`);
      }
    } catch (error) {
      console.log(`⚠️  Could not check port ${port}`);
    }
  }
  
  // Wait a moment for ports to be fully freed
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function startBackendServer() {
  console.log('🚀 Starting backend server...');
  
  return new Promise((resolve) => {
    const backendProcess = spawn('node', ['server.js'], {
      cwd: 'backend',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let started = false;
    let output = '';
    
    const timeout = setTimeout(() => {
      if (!started) {
        console.log('⏰ Backend startup timeout');
        resolve(false);
      }
    }, 30000);
    
    backendProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[BACKEND]', text.trim());
      
      if (text.includes('Server running on port') || 
          text.includes('3001') || 
          text.includes('listening')) {
        started = true;
        clearTimeout(timeout);
        console.log('✅ Backend server started');
        resolve(true);
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.log('[BACKEND ERROR]', data.toString().trim());
    });
    
    backendProcess.on('exit', (code) => {
      if (!started) {
        console.log('❌ Backend process exited with code:', code);
        clearTimeout(timeout);
        resolve(false);
      }
    });
  });
}

async function startFrontendServer() {
  console.log('🚀 Starting frontend server...');
  
  return new Promise((resolve) => {
    const frontendProcess = spawn('npm', ['start'], {
      cwd: 'frontend',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let started = false;
    let output = '';
    
    const timeout = setTimeout(() => {
      if (!started) {
        console.log('⏰ Frontend startup timeout');
        resolve(false);
      }
    }, 60000);
    
    frontendProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[FRONTEND]', text.trim());
      
      if (text.includes('webpack compiled') || 
          text.includes('Local:') || 
          text.includes('localhost:3000') ||
          text.includes('development server') ||
          text.includes('compiled successfully')) {
        started = true;
        clearTimeout(timeout);
        console.log('✅ Frontend server started');
        resolve(true);
      }
    });
    
    frontendProcess.stderr.on('data', (data) => {
      const text = data.toString();
      console.log('[FRONTEND ERROR]', text.trim());
      
      if (text.includes('compiled successfully')) {
        started = true;
        clearTimeout(timeout);
        console.log('✅ Frontend server started');
        resolve(true);
      }
    });
    
    frontendProcess.on('exit', (code) => {
      if (!started) {
        console.log('❌ Frontend process exited with code:', code);
        clearTimeout(timeout);
        resolve(false);
      }
    });
  });
}

async function tryAlternativeBackendStart() {
  console.log('🔄 Trying alternative backend start methods...');
  
  // Method 1: Direct npm start in backend folder
  console.log('🔄 Method 1: npm start in backend...');
  const npmStart = spawn('npm', ['start'], {
    cwd: 'backend',
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Method 2: Direct node command with full path
  console.log('🔄 Method 2: Direct node server.js...');
  const directNode = spawn('node', ['backend/server.js'], {
    stdio: 'inherit'
  });
  
  await new Promise(resolve => setTimeout(resolve, 5000));
}

async function tryAlternativeFrontendStart() {
  console.log('🔄 Trying alternative frontend start methods...');
  
  // Check if node_modules exists
  console.log('🔍 Checking frontend dependencies...');
  try {
    const fs = require('fs');
    if (!fs.existsSync('frontend/node_modules')) {
      console.log('📦 Installing frontend dependencies...');
      const installCmd = spawn('npm', ['install'], {
        cwd: 'frontend',
        stdio: 'inherit',
        shell: true
      });
      
      await new Promise(resolve => installCmd.on('close', resolve));
    }
  } catch (error) {
    console.log('⚠️  Could not check/install dependencies');
  }
  
  // Try starting again
  console.log('🔄 Retrying frontend start...');
  const retryStart = spawn('npm', ['start'], {
    cwd: 'frontend',
    stdio: 'inherit', 
    shell: true
  });
  
  await new Promise(resolve => setTimeout(resolve, 10000));
}

async function finalVerification() {
  console.log('🧪 Testing services...');
  
  // Test backend
  try {
    const backendTest = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
    console.log('✅ Backend is responding');
  } catch (error) {
    console.log('❌ Backend not responding:', error.message);
  }
  
  // Test frontend
  try {
    const frontendTest = await axios.get('http://localhost:3000', { timeout: 5000 });
    console.log('✅ Frontend is responding');
  } catch (error) {
    console.log('❌ Frontend not responding:', error.message);
  }
  
  // Test login
  try {
    const loginTest = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }, { timeout: 5000 });
    
    if (loginTest.data.success) {
      console.log('✅ Authentication working');
      
      // Test SIIGO categories
      try {
        const categoriesTest = await axios.get('http://localhost:3001/api/siigo-categories/local', {
          headers: { 'Authorization': `Bearer ${loginTest.data.token}` },
          timeout: 10000
        });
        
        if (categoriesTest.data.success) {
          console.log('✅ SIIGO categories endpoint working');
          console.log(`📂 Categories available: ${categoriesTest.data.categories?.length || 0}`);
        } else {
          console.log('⚠️  SIIGO categories endpoint needs attention');
        }
      } catch (catError) {
        console.log('⚠️  SIIGO categories test failed:', catError.message);
      }
    }
  } catch (error) {
    console.log('❌ Authentication test failed:', error.message);
  }
}

// Keep processes running
process.on('SIGINT', () => {
  console.log('\n👋 Complete restart script exiting...');
  process.exit();
});

completeSystemRestart().catch(console.error);
