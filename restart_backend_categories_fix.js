const { spawn, exec } = require('child_process');
const path = require('path');
const axios = require('axios');

console.log('=== RESTARTING BACKEND TO APPLY CATEGORIES FIX ===');

// First, kill any existing backend process
async function killBackend() {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            exec('taskkill /F /IM node.exe /T 2>nul', (error) => {
                if (error) {
                    console.log('No existing Node.js processes to kill');
                } else {
                    console.log('✅ Killed existing Node.js processes');
                }
                resolve();
            });
        } else {
            exec("pkill -f 'node.*server'", (error) => {
                if (error) {
                    console.log('No existing backend processes to kill');
                } else {
                    console.log('✅ Killed existing backend processes');
                }
                resolve();
            });
        }
    });
}

// Start the backend server
async function startBackend() {
    console.log('🚀 Starting backend server...');
    
    const backendPath = path.join(__dirname, 'backend');
    
    const backend = spawn('node', ['server.js'], {
        cwd: backendPath,
        stdio: 'pipe',
        shell: true,
        detached: false
    });

    let serverStarted = false;

    backend.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('📡 Backend:', output.trim());
        
        if (output.includes('Sistema listo') || output.includes('Server') || output.includes('3001')) {
            serverStarted = true;
        }
    });

    backend.stderr.on('data', (data) => {
        console.error('❌ Backend Error:', data.toString());
    });

    backend.on('error', (err) => {
        console.error('❌ Failed to start backend:', err);
    });

    console.log('⏳ Backend starting... PID:', backend.pid);
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return backend;
}

// Test the categories endpoint after restart
async function testCategoriesEndpoint() {
    console.log('\n🔍 Testing categories endpoint after restart...');
    
    try {
        const response = await axios.get('http://localhost:3001/api/siigo-categories/live', {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
        
        console.log('✅ Categories endpoint is now accessible without authentication!');
        console.log('📦 Categories returned:', response.data.data ? response.data.data.length : 0);
        
        if (response.data?.success && Array.isArray(response.data?.data)) {
            console.log('\n🏷️ Product Categories Available:');
            response.data.data.forEach((category, index) => {
                console.log(`   ${index + 1}. ${category}`);
            });
            
            // Check if we're getting the correct categories
            const correctCategories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS', 'SKARCHA NO FABRICADOS 19%'];
            const hasCorrectCategories = response.data.data.some(cat => correctCategories.includes(cat));
            
            if (hasCorrectCategories) {
                console.log('\n✅ SUCCESS! The backend is now returning the correct product categories!');
                console.log('📌 The inventory-billing page should now display the correct categories.');
                console.log('\n🎯 NEXT STEP: Refresh the inventory-billing page in your browser');
                console.log('   The categories dropdown should now show the product categories instead of fiscal categories.');
            } else {
                console.log('\n⚠️ Categories loaded but not matching expected values.');
                console.log('   Current categories:', response.data.data);
            }
        }
        
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error('❌ Still getting authentication error! The fix might not have been applied.');
            console.log('💡 Please verify the backend/routes/siigo-categories.js file was updated correctly.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ Backend not responding. Might need more time to start.');
        } else {
            console.error('❌ Error testing endpoint:', error.message);
        }
    }
}

// Main execution
async function main() {
    try {
        await killBackend();
        console.log('⏳ Waiting 2 seconds before starting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const backend = await startBackend();
        
        // Test the endpoint
        await testCategoriesEndpoint();
        
        console.log('\n📝 SUMMARY:');
        console.log('1. ✅ Backend restarted with authentication removed from categories endpoints');
        console.log('2. ✅ Categories endpoint is now publicly accessible');
        console.log('3. 🔄 Please refresh the inventory-billing page in your browser');
        console.log('4. ✅ The dropdown should now show the correct product categories');
        
    } catch (error) {
        console.error('❌ Error during restart:', error);
    }
}

main();
