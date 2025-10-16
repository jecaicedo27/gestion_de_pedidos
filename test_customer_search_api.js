const http = require('http');
const { URL } = require('url');

function testCustomerSearchAPI() {
    const url = new URL('http://localhost:3001/api/quotations/customers/search?q=108');
    
    const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    console.log('🧪 Testing Customer Search API...');
    console.log(`📍 URL: ${url.toString()}`);
    
    const req = http.request(options, (res) => {
        console.log(`📊 Status Code: ${res.statusCode}`);
        console.log(`📋 Headers:`, res.headers);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const jsonData = JSON.parse(data);
                console.log('✅ Response received:');
                console.log(JSON.stringify(jsonData, null, 2));
                
                if (jsonData.success && jsonData.customers) {
                    console.log(`📊 Found ${jsonData.customers.length} customers`);
                    if (jsonData.customers.length > 0) {
                        console.log('🔍 Sample customer:');
                        console.log(`   - Name: ${jsonData.customers[0].name}`);
                        console.log(`   - Document: ${jsonData.customers[0].document}`);
                        console.log(`   - ID: ${jsonData.customers[0].id}`);
                    }
                } else {
                    console.log('⚠️ API response format unexpected');
                }
            } catch (error) {
                console.log('❌ Error parsing JSON response:');
                console.log(data);
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Request failed:', error.message);
    });
    
    req.setTimeout(5000, () => {
        console.error('⏰ Request timeout');
        req.destroy();
    });
    
    req.end();
}

testCustomerSearchAPI();
