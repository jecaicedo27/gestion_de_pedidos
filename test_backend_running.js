const axios = require('axios');

async function testBackendStatus() {
    console.log('=== TESTING BACKEND STATUS ===');
    
    try {
        console.log('🔍 Testing backend health endpoint...');
        
        const response = await axios.get('http://localhost:3001/api/health', {
            timeout: 5000
        });
        
        console.log('✅ Backend is running!');
        console.log('📦 Response:', response.data);
        
        // Also test the categories endpoint
        console.log('\n🔍 Now testing categories endpoint...');
        
        try {
            const categoriesResponse = await axios.get('http://localhost:3001/api/siigo-categories/live');
            console.log('✅ Categories endpoint working:', categoriesResponse.data);
        } catch (catError) {
            console.error('❌ Categories endpoint error:', catError.response?.status, catError.response?.data || catError.message);
        }
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Backend is NOT running!');
            console.log('💡 Need to start the backend server');
            console.log('🚀 Running: node backend/server.js');
            
            // Start backend automatically
            const { spawn } = require('child_process');
            console.log('\n🔄 Attempting to start backend...');
            
            const backend = spawn('node', ['backend/server.js'], {
                detached: true,
                stdio: 'pipe'
            });
            
            backend.stdout.on('data', (data) => {
                console.log('📡 Backend:', data.toString());
            });
            
            backend.stderr.on('data', (data) => {
                console.error('❌ Backend Error:', data.toString());
            });
            
            console.log('⏳ Backend starting... PID:', backend.pid);
            console.log('💡 Wait a few seconds and then test the categories endpoint again');
            
        } else {
            console.error('❌ Other error:', error.message);
        }
    }
}

testBackendStatus();
