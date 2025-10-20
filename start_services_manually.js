const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting services manually...\n');

// Start backend
console.log('Starting backend on port 3001...');
const backendProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit',
    shell: true
});

// Wait a bit and start frontend
setTimeout(() => {
    console.log('\nStarting frontend on port 3000...');
    const frontendProcess = spawn('npm', ['start'], {
        cwd: path.join(__dirname, 'frontend'),
        stdio: 'inherit',
        shell: true
    });
    
    frontendProcess.on('error', (error) => {
        console.error('Error starting frontend:', error);
    });
}, 3000);

backendProcess.on('error', (error) => {
    console.error('Error starting backend:', error);
});

// Keep process running
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping services...');
    process.exit(0);
});
