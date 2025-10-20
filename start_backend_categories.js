const { spawn } = require('child_process');
const path = require('path');

console.log('=== STARTING BACKEND SERVER ===');
console.log('Starting backend to apply categories fix...');

// Start the backend
const backendPath = path.join(__dirname, 'backend');
const backend = spawn('npm', ['start'], {
    cwd: backendPath,
    stdio: 'inherit',
    shell: true
});

backend.on('error', (err) => {
    console.error('❌ Failed to start backend:', err.message);
    process.exit(1);
});

// Give the backend time to start
setTimeout(() => {
    console.log('\n✅ Backend should be running now!');
    console.log('📌 Please refresh the Inventory-Billing page to see the correct categories');
    console.log('📌 Categories should now show: GENIALITY, LIQUIPOPS, MEZCLAS EN POLVO, etc.');
    console.log('\n⚠️  Keep this terminal open to keep the backend running');
}, 10000);
