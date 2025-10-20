const path = require('path');
const axios = require('axios');

// Load environment variables from the correct path
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function debugSiigoAuthentication() {
    console.log('🔐 Debugging SIIGO Authentication Issues...\n');
    
    console.log('📋 Environment Variables:');
    console.log('SIIGO_API_USERNAME:', process.env.SIIGO_API_USERNAME ? '✅ Set' : '❌ Missing');
    console.log('SIIGO_API_ACCESS_KEY:', process.env.SIIGO_API_ACCESS_KEY ? '✅ Set' : '❌ Missing');
    
    if (process.env.SIIGO_API_USERNAME) {
        console.log('Username:', process.env.SIIGO_API_USERNAME);
    }
    if (process.env.SIIGO_API_ACCESS_KEY) {
        console.log('Access Key length:', process.env.SIIGO_API_ACCESS_KEY.length);
        console.log('Access Key first 10 chars:', process.env.SIIGO_API_ACCESS_KEY.substring(0, 10) + '...');
    }
    console.log('');
    
    if (!process.env.SIIGO_API_USERNAME || !process.env.SIIGO_API_ACCESS_KEY) {
        console.log('❌ Missing required SIIGO credentials');
        return false;
    }
    
    const requestData = {
        username: process.env.SIIGO_API_USERNAME,
        access_key: process.env.SIIGO_API_ACCESS_KEY
    };
    
    console.log('📋 Request payload:');
    console.log(JSON.stringify({
        username: requestData.username,
        access_key: requestData.access_key.substring(0, 10) + '...[hidden]'
    }, null, 2));
    console.log('');
    
    try {
        console.log('🔐 Sending authentication request to SIIGO...');
        console.log('URL: https://api.siigo.com/auth');
        console.log('Method: POST');
        console.log('');
        
        const authResponse = await axios.post('https://api.siigo.com/auth', requestData, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Gestion-Pedidos-App/1.0'
            },
            timeout: 30000 // 30 second timeout
        });
        
        console.log('✅ Authentication successful!');
        console.log('Response status:', authResponse.status);
        console.log('Response headers:', JSON.stringify(authResponse.headers, null, 2));
        console.log('Response data keys:', Object.keys(authResponse.data));
        
        if (authResponse.data.access_token) {
            console.log('Token received: ✅');
            console.log('Token length:', authResponse.data.access_token.length);
            console.log('Token first 20 chars:', authResponse.data.access_token.substring(0, 20) + '...');
            
            // Test the token with a simple API call
            console.log('\n📦 Testing token with products API...');
            const testResponse = await axios.get('https://api.siigo.com/v1/products?page_size=1', {
                headers: {
                    'Authorization': authResponse.data.access_token,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            
            console.log('✅ Token test successful!');
            console.log('Products API status:', testResponse.status);
            console.log('Products found:', testResponse.data.results?.length || 0);
            
        } else {
            console.log('Token received: ❌');
            console.log('Response data:', JSON.stringify(authResponse.data, null, 2));
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Authentication failed:');
        console.log('Error type:', error.constructor.name);
        console.log('Error message:', error.message);
        
        if (error.code) {
            console.log('Error code:', error.code);
        }
        
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response statusText:', error.response.statusText);
            console.log('Response headers:', JSON.stringify(error.response.headers, null, 2));
            console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.log('Request was made but no response received');
            console.log('Request details:', {
                url: error.request.path,
                method: error.request.method,
                headers: error.request.getHeaders ? error.request.getHeaders() : 'N/A'
            });
        } else {
            console.log('Error setting up request:', error.message);
        }
        
        console.log('Full error object:', JSON.stringify({
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        }, null, 2));
        
        return false;
    }
}

async function testAlternativeAuthMethods() {
    console.log('\n🔄 Testing alternative authentication methods...\n');
    
    const methods = [
        {
            name: 'Method 1: Standard headers',
            config: {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        },
        {
            name: 'Method 2: With User-Agent',
            config: {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; GestionPedidos/1.0)'
                }
            }
        },
        {
            name: 'Method 3: With Accept header',
            config: {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        }
    ];
    
    for (const method of methods) {
        console.log(`Testing ${method.name}...`);
        
        try {
            const response = await axios.post('https://api.siigo.com/auth', {
                username: process.env.SIIGO_API_USERNAME,
                access_key: process.env.SIIGO_API_ACCESS_KEY
            }, {
                ...method.config,
                timeout: 15000
            });
            
            console.log(`✅ ${method.name} - SUCCESS!`);
            console.log('Status:', response.status);
            console.log('Token received:', response.data.access_token ? '✅' : '❌');
            return true;
            
        } catch (error) {
            console.log(`❌ ${method.name} - FAILED`);
            console.log('Status:', error.response?.status || 'No response');
            console.log('Error:', error.response?.data?.message || error.message);
        }
        
        console.log('');
    }
    
    return false;
}

async function main() {
    console.log('🚀 Complete SIIGO Authentication Debug\n');
    console.log('='.repeat(60));
    
    const authResult = await debugSiigoAuthentication();
    
    if (!authResult) {
        console.log('\n' + '='.repeat(60));
        await testAlternativeAuthMethods();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 Debug completed!');
    
    if (authResult) {
        console.log('\n✅ RESULT: Authentication is working correctly!');
        console.log('🔧 The stock sync system can now be implemented.');
    } else {
        console.log('\n❌ RESULT: Authentication issues need further investigation.');
        console.log('🔧 Check SIIGO credentials and API endpoint availability.');
    }
}

main().catch(console.error);
