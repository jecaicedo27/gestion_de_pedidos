const { exec } = require('child_process');
const path = require('path');

console.log('🚀 Restarting backend properly...\n');

// Kill any existing Node.js processes
exec('taskkill /F /IM node.exe', (error) => {
    if (error && !error.message.includes('not found')) {
        console.log('⚠️ No existing Node processes to kill');
    }
    
    console.log('✅ Cleaned up existing processes');
    
    // Wait a moment before starting
    setTimeout(() => {
        console.log('\n📦 Starting backend server...');
        
        // Start the backend
        const backendPath = path.join(__dirname, 'backend');
        const backend = exec('npm start', { 
            cwd: backendPath,
            env: { ...process.env, NODE_ENV: 'development' }
        });
        
        backend.stdout.on('data', (data) => {
            console.log(data.toString());
            
            // Check if backend is ready
            if (data.includes('Servidor escuchando') || data.includes('Server listening') || data.includes('3001')) {
                console.log('\n✅ Backend is running on port 3001');
                console.log('📊 Services initialized:');
                console.log('  - Express server');
                console.log('  - MySQL database connection');
                console.log('  - Authentication middleware');
                console.log('  - API routes');
                console.log('\nPress Ctrl+C to stop the server');
            }
        });
        
        backend.stderr.on('data', (data) => {
            if (!data.includes('Warning') && !data.includes('deprecated')) {
                console.error('❌ Backend error:', data.toString());
            }
        });
        
        backend.on('error', (error) => {
            console.error('❌ Failed to start backend:', error.message);
        });
        
    }, 2000);
});
