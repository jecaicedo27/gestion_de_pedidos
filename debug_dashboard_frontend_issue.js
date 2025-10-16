const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testDashboardFlow() {
    try {
        console.log('=== TESTING DASHBOARD ANALYTICS FLOW ===\n');
        
        // 1. Login first
        console.log('1. Testing login...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        console.log('Login Response Status:', loginResponse.status);
        console.log('Login Response Data:', JSON.stringify(loginResponse.data, null, 2));
        
        if (loginResponse.data.success) {
            const token = loginResponse.data.data.token;
            console.log('✅ Login successful, token extracted:', token.substring(0, 50) + '...\n');
            
            // 2. Test analytics endpoint
            console.log('2. Testing analytics endpoint...');
            const analyticsResponse = await axios.get(`${BASE_URL}/analytics/advanced-dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('Analytics Response Status:', analyticsResponse.status);
            console.log('Analytics Response Keys:', Object.keys(analyticsResponse.data));
            
            if (analyticsResponse.data.data) {
                const data = analyticsResponse.data.data;
                console.log('\n=== ANALYTICS DATA ===');
                console.log('Daily Shipments:', data.dailyShipments ? 'Present' : 'Missing');
                console.log('Top Cities:', data.topShippingCities ? 'Present' : 'Missing');
                console.log('Top Customers:', data.topCustomers ? 'Present' : 'Missing');
                console.log('Customer Repeats:', data.customerRepeatPurchases ? 'Present' : 'Missing');
                console.log('Lost Customers:', data.lostCustomers ? 'Present' : 'Missing');
                console.log('New Customers:', data.newCustomersDaily ? 'Present' : 'Missing');
                console.log('Performance Metrics:', data.performanceMetrics ? 'Present' : 'Missing');
                console.log('Sales Trends:', data.salesTrends ? 'Present' : 'Missing');
                console.log('Product Performance:', data.productPerformance ? 'Present' : 'Missing');
                
                // Show actual data
                if (data.performanceMetrics) {
                    console.log('\n=== PERFORMANCE METRICS SAMPLE ===');
                    console.log(JSON.stringify(data.performanceMetrics, null, 2));
                }
            } else {
                console.log('❌ No data object found in response');
                console.log('Full response:', JSON.stringify(analyticsResponse.data, null, 2));
            }
            
        } else {
            console.log('❌ Login failed:', loginResponse.data);
        }
        
    } catch (error) {
        console.error('❌ Error in dashboard flow:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Test basic connectivity
async function testConnectivity() {
    try {
        console.log('=== TESTING BASIC CONNECTIVITY ===\n');
        
        // Test basic server response
        const healthResponse = await axios.get(`${BASE_URL}/auth/health`, {
            timeout: 5000
        });
        
        console.log('Health check response:', healthResponse.status);
        
        // Test CORS and preflight
        const corsResponse = await axios.options(`${BASE_URL}/analytics/advanced-dashboard`);
        console.log('CORS preflight response:', corsResponse.status);
        
    } catch (error) {
        console.error('❌ Connectivity error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('Backend server is not running or not accessible');
        }
    }
}

async function main() {
    await testConnectivity();
    await testDashboardFlow();
}

main();
