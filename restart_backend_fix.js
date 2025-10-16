const { spawn, exec } = require('child_process');
const path = require('path');

console.log('🔄 Restarting backend server...');

// Kill any existing process on port 3001
exec('netstat -ano | findstr :3001', (error, stdout, stderr) => {
    if (stdout) {
        const lines = stdout.split('\n');
        const listeningLine = lines.find(line => line.includes('LISTENING'));
        if (listeningLine) {
            const parts = listeningLine.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            console.log(`💀 Killing existing process PID: ${pid}`);
            exec(`taskkill /f /pid ${pid}`, (killError) => {
                if (killError) {
                    console.log('⚠️  No process to kill or already killed');
                }
                startBackend();
            });
        } else {
            startBackend();
        }
    } else {
        startBackend();
    }
});

function startBackend() {
    console.log('🚀 Starting backend server...');
    
    const backendPath = path.join(__dirname, 'backend');
    const server = spawn('node', ['server.js'], {
        cwd: backendPath,
        stdio: 'inherit',
        shell: true
    });

    server.on('error', (err) => {
        console.error('❌ Error starting backend:', err);
    });

    server.on('close', (code) => {
        console.log(`🔴 Backend process exited with code ${code}`);
    });

    // Give it some time to start
    setTimeout(() => {
        console.log('✅ Backend should be starting now...');
        process.exit(0);
    }, 3000);
}
