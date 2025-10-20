const axios = require('axios');

async function testFrontendBackendConnectivity() {
    console.log('🔍 Testing full application connectivity...\n');
    
    // Test key endpoints that the frontend tries to access
    const keyEndpoints = [
        { 
            url: 'http://localhost:3001/api/siigo/invoices?page=1&page_size=5', 
            name: 'Paginated Invoice Loading',
            description: 'Frontend invoice pagination system'
        },
        { 
            url: 'http://localhost:3001/api/siigo/connection/status', 
            name: 'Connection Status Check',
            description: 'Real-time connection monitoring'
        },
        { 
            url: 'http://localhost:3001/api/siigo/automation/status', 
            name: 'Automation Status',
            description: 'Frontend automation monitoring'
        }
    ];
    
    let allWorking = true;
    
    for (const endpoint of keyEndpoints) {
        try {
            console.log(`🧪 Testing: ${endpoint.name}`);
            console.log(`   Purpose: ${endpoint.description}`);
            console.log(`   URL: ${endpoint.url}`);
            
            const response = await axios.get(endpoint.url, { 
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`   ✅ Status: ${response.status} - SUCCESS`);
            
            if (response.data) {
                if (typeof response.data === 'object') {
                    console.log(`   📄 Response type: Object with ${Object.keys(response.data).length} properties`);
                } else {
                    console.log(`   📄 Response type: ${typeof response.data}`);
                }
            }
            
        } catch (error) {
            allWorking = false;
            console.log(`   ❌ FAILED: ${error.message}`);
            
            if (error.response) {
                console.log(`   📋 Status: ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data) {
                    console.log(`   📋 Error details:`, error.response.data);
                }
            } else if (error.code === 'ECONNREFUSED') {
                console.log(`   📋 Issue: Backend server not responding`);
            } else if (error.code === 'ETIMEDOUT') {
                console.log(`   📋 Issue: Request timeout - server may be overloaded`);
            }
        }
        console.log('');
    }
    
    // Test WebSocket connectivity
    console.log('🔌 Testing WebSocket connectivity...');
    try {
        // This will fail but we can check if the port responds
        await axios.get('http://localhost:3000/ws');
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('   ✅ WebSocket port responding (404 expected for HTTP request to WebSocket endpoint)');
        } else {
            console.log('   ❌ WebSocket connectivity issue:', error.message);
        }
    }
    
    // Test Socket.IO connectivity  
    console.log('🔌 Testing Socket.IO connectivity...');
    try {
        await axios.get('http://localhost:3001/socket.io/', { timeout: 5000 });
    } catch (error) {
        if (error.response && (error.response.status === 200 || error.response.status === 400)) {
            console.log('   ✅ Socket.IO responding');
        } else {
            console.log('   ❌ Socket.IO connectivity issue:', error.message);
        }
    }
    
    console.log('\n🎯 Summary:');
    if (allWorking) {
        console.log('✅ All critical backend endpoints are responding correctly!');
        console.log('✅ The 500 Internal Server Error and connection issues have been resolved.');
        console.log('✅ Frontend should now be able to load data properly.');
    } else {
        console.log('❌ Some endpoints are still having issues.');
        console.log('❌ Further investigation needed.');
    }
}

testFrontendBackendConnectivity().catch(console.error);
