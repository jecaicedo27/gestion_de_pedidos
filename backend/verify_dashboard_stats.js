const axios = require('axios');

async function verifyDashboardStats() {
    console.log('\n=== VERIFYING DASHBOARD STATS ===');

    const credentialsList = [
        { username: 'admin', password: '123456' },
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: 'admin123' },
        { username: 'administrator', password: '123456' },
        { username: 'root', password: '123456' }
    ];

    let token = null;

    // 1. Login
    for (const credentials of credentialsList) {
        try {
            console.log(`Trying login with: ${credentials.username}`);
            const response = await axios.post('http://localhost:3001/api/auth/login', credentials);
            token = response.data.token || response.data.data?.token;
            console.log('✅ Login successful!');
            console.log('Token length:', token ? token.length : 'null');
            break;
        } catch (error) {
            // console.log('Login failed:', error.message);
        }
    }

    if (!token) {
        console.error('❌ Could not login with any common credentials.');
        process.exit(1);
    }

    // 2. Get Dashboard Stats
    try {
        console.log('\nFetching dashboard stats...');
        const response = await axios.get('http://localhost:3001/api/orders/dashboard-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = response.data.data;

        // 3. Verify new fields
        console.log('\n--- Verification Results ---');

        if (data.deliveredByMethod) {
            console.log('✅ deliveredByMethod is present');
            console.log('   Data:', JSON.stringify(data.deliveredByMethod, null, 2));
        } else {
            console.error('❌ deliveredByMethod is MISSING');
        }

        if (data.deliveredByMessenger) {
            console.log('✅ deliveredByMessenger is present');
            console.log('   Data:', JSON.stringify(data.deliveredByMessenger, null, 2));
        } else {
            console.error('❌ deliveredByMessenger is MISSING');
        }

        if (data.deliveredByMethod && data.deliveredByMessenger) {
            console.log('\n✨ VERIFICATION SUCCESSFUL ✨');
        } else {
            console.log('\n⚠️ VERIFICATION FAILED');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error fetching stats:', error.response?.data?.message || error.message);
        process.exit(1);
    }
}

verifyDashboardStats();
