const axios = require('axios');

async function testDifferentCredentials() {
    console.log('\n=== TESTING DIFFERENT ADMIN CREDENTIALS ===');
    
    const credentialsList = [
        { username: 'admin', password: '123456' },
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: 'admin123' },
        { username: 'administrator', password: '123456' },
        { username: 'root', password: '123456' },
        { username: 'admin', password: 'password' }
    ];

    for (const credentials of credentialsList) {
        try {
            console.log(`\nTesting: ${credentials.username}/${credentials.password}`);
            
            const response = await axios.post('http://localhost:3001/api/auth/login', {
                username: credentials.username,
                password: credentials.password
            });

            console.log('✅ SUCCESS! Found working credentials:');
            console.log('Username:', credentials.username);
            console.log('Password:', credentials.password);
            console.log('Response:', JSON.stringify(response.data, null, 2));
            
            return credentials; // Return successful credentials
            
        } catch (error) {
            console.log('❌ Failed:', error.response?.data?.message || error.message);
        }
    }

    console.log('\n⚠️ None of the tested credentials worked. Let me check what admin users exist in the database.');
    return null;
}

async function checkDatabaseUsers() {
    console.log('\n=== CHECKING DATABASE USERS ===');
    try {
        // Try to call a simple endpoint to see what happens
        const response = await axios.get('http://localhost:3001/api/users', {
            headers: {
                'Authorization': 'Bearer invalid-token'
            }
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.log('Expected auth error:', error.response?.data?.message || error.message);
    }

    // Test basic server connectivity
    try {
        const response = await axios.get('http://localhost:3001/api/health');
        console.log('Server health check:', response.data);
    } catch (error) {
        console.log('No health endpoint, trying root path');
        try {
            const response = await axios.get('http://localhost:3001/');
            console.log('Server root response:', response.data);
        } catch (error2) {
            console.log('Root path error:', error2.message);
        }
    }
}

testDifferentCredentials()
    .then(credentials => {
        if (!credentials) {
            return checkDatabaseUsers();
        }
    })
    .catch(console.error);
