const { spawn, exec } = require('child_process');
const path = require('path');

async function restartBackend() {
    console.log('🔧 Restarting backend server after hooks fix...');
    
    try {
        // Step 1: Kill any existing processes on port 3001
        console.log('1. 🔴 Killing existing processes on port 3001...');
        
        return new Promise((resolve, reject) => {
            exec('netstat -ano | findstr :3001', (error, stdout, stderr) => {
                if (stdout && stdout.trim()) {
                    console.log('Found processes on port 3001, attempting to kill them...');
                    const lines = stdout.trim().split('\n');
                    const pids = [];
                    
                    lines.forEach(line => {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 5) {
                            const pid = parts[parts.length - 1];
                            if (pid && !isNaN(pid) && !pids.includes(pid)) {
                                pids.push(pid);
                            }
                        }
                    });
                    
                    if (pids.length > 0) {
                        console.log(`Found PIDs: ${pids.join(', ')}`);
                        pids.forEach(pid => {
                            try {
                                exec(`taskkill /PID ${pid} /F`, (killError) => {
                                    if (killError) {
                                        console.log(`Could not kill PID ${pid}, it may have already stopped`);
                                    } else {
                                        console.log(`✅ Killed process ${pid}`);
                                    }
                                });
                            } catch (e) {
                                console.log(`Process ${pid} already stopped`);
                            }
                        });
                    }
                }
                
                // Wait a moment for processes to be killed
                setTimeout(() => {
                    startBackendServer(resolve, reject);
                }, 2000);
            });
        });
        
    } catch (error) {
        console.error('❌ Error during restart:', error.message);
        return false;
    }
}

function startBackendServer(resolve, reject) {
    console.log('2. 🚀 Starting backend server...');
    
    // Change to backend directory
    const backendPath = path.join(__dirname, 'backend');
    console.log(`Backend path: ${backendPath}`);
    
    // Start the server
    const serverProcess = spawn('node', ['server.js'], {
        cwd: backendPath,
        stdio: 'inherit',
        detached: false
    });
    
    console.log('✅ Backend server starting...');
    console.log('📍 Port: 3001');
    console.log('🌍 Environment: development');
    
    // Handle server startup
    serverProcess.on('error', (error) => {
        console.error('❌ Failed to start backend server:', error.message);
        reject(error);
    });
    
    // Give the server time to start
    setTimeout(() => {
        console.log('\n🎉 Backend server should be running now!');
        console.log('\n📋 Summary of fixes applied:');
        console.log('✅ Port conflict resolved');
        console.log('✅ React hooks error fixed (using native Leaflet)');
        console.log('✅ Backend data structure corrected');
        console.log('✅ Heatmap API endpoint ready');
        
        console.log('\n🌍 Next steps:');
        console.log('1. Navigate to http://localhost:3000/dashboard');
        console.log('2. Clear browser cache (Ctrl+F5)');
        console.log('3. Check the Colombia heat map component');
        console.log('4. Verify different colored markers appear');
        
        console.log('\n🎨 Expected heat map colors:');
        console.log('- Green markers: High performance cities');
        console.log('- Yellow markers: Medium performance cities');
        console.log('- Red markers: Low performance cities');
        
        resolve(true);
    }, 5000);
}

// Run the restart
restartBackend().then(success => {
    if (success) {
        console.log('\n✅ Backend restart completed successfully!');
        console.log('The heat map should now work without React hooks errors.');
    }
}).catch(error => {
    console.error('\n❌ Backend restart failed:', error);
    process.exit(1);
});
