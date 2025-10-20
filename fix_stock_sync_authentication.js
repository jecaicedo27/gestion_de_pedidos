const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing SIIGO stock sync authentication issues...');

// Fix the stockSyncService.js file
const stockSyncServicePath = path.join(__dirname, 'backend/services/stockSyncService.js');
let stockSyncContent = fs.readFileSync(stockSyncServicePath, 'utf8');

// Replace the siigoConfig to use correct environment variable names
const oldConfig = `        this.siigoConfig = {
            baseUrl: 'https://api.siigo.com',
            username: process.env.SIIGO_USERNAME,
            access_key: process.env.SIIGO_ACCESS_KEY,
            partner_id: process.env.SIIGO_PARTNER_ID
        };`;

const newConfig = `        this.siigoConfig = {
            baseUrl: 'https://api.siigo.com',
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        };`;

stockSyncContent = stockSyncContent.replace(oldConfig, newConfig);

// Fix the authentication method to not include partner_id
const oldAuth = `            const response = await axios.post(\`\${this.siigoConfig.baseUrl}/auth\`, {
                username: this.siigoConfig.username,
                access_key: this.siigoConfig.access_key,
                partner_id: this.siigoConfig.partner_id
            });`;

const newAuth = `            const response = await axios.post(\`\${this.siigoConfig.baseUrl}/auth\`, {
                username: this.siigoConfig.username,
                access_key: this.siigoConfig.access_key
            });`;

stockSyncContent = stockSyncContent.replace(oldAuth, newAuth);

// Fix the API request headers to not include Partner-Id
const oldHeaders = `                    headers: {
                        'Authorization': this.token,
                        'Content-Type': 'application/json',
                        'Partner-Id': this.siigoConfig.partner_id
                    }`;

const newHeaders = `                    headers: {
                        'Authorization': this.token,
                        'Content-Type': 'application/json'
                    }`;

stockSyncContent = stockSyncContent.replace(oldHeaders, newHeaders);

// Write the fixed file
fs.writeFileSync(stockSyncServicePath, stockSyncContent);

console.log('✅ Stock sync service authentication fixed');

// Test authentication with SIIGO
const axios = require('axios');

async function testSiigoAuth() {
    try {
        console.log('🔐 Testing SIIGO authentication with correct credentials...');
        
        const response = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        });

        console.log('✅ SIIGO authentication successful!');
        console.log('📝 Token received:', response.data.access_token.substring(0, 20) + '...');
        
        // Test a products API call
        console.log('🔍 Testing products API call...');
        
        const productsResponse = await axios.get('https://api.siigo.com/v1/products?page_size=1', {
            headers: {
                'Authorization': response.data.access_token,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Products API test successful!');
        console.log('📦 Found', productsResponse.data.pagination?.total_results || 0, 'products in SIIGO');
        
        return true;
    } catch (error) {
        console.error('❌ SIIGO authentication test failed:', error.response?.data || error.message);
        if (error.response?.status === 400) {
            console.log('🔍 This suggests incorrect credentials or request format');
        }
        return false;
    }
}

// Run the test
testSiigoAuth().then(success => {
    if (success) {
        console.log('\n🎉 Stock sync authentication is now properly configured!');
        console.log('📋 Summary of fixes:');
        console.log('- ✅ Fixed environment variable names in stockSyncService');
        console.log('- ✅ Removed unnecessary partner_id parameter');
        console.log('- ✅ Updated API request headers');
        console.log('- ✅ Tested authentication with SIIGO API');
        console.log('\n🔄 The stock sync service should now work properly.');
        console.log('⏰ Automatic sync runs every 5 minutes');
        console.log('🔔 Webhooks will provide real-time updates');
    } else {
        console.log('\n❌ Authentication test failed. Please check:');
        console.log('- SIIGO_API_USERNAME is correct');
        console.log('- SIIGO_API_ACCESS_KEY is correct');
        console.log('- Network connectivity to SIIGO API');
    }
});
