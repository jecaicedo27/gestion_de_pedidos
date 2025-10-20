const axios = require('axios');
require('dotenv').config();

class SiigoStatusDebugger {
    constructor() {
        this.siigoConfig = {
            baseUrl: 'https://api.siigo.com',
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        };
        this.token = null;
    }

    async authenticate() {
        try {
            console.log('🔐 Autenticando con SIIGO API...');
            
            const response = await axios.post(`${this.siigoConfig.baseUrl}/auth`, {
                username: this.siigoConfig.username,
                access_key: this.siigoConfig.access_key
            });

            this.token = response.data.access_token;
            console.log('✅ Autenticación exitosa');
            return true;
        } catch (error) {
            console.error('❌ Error autenticando:', error.message);
            return false;
        }
    }

    async testInactiveProduct() {
        if (!await this.authenticate()) {
            return;
        }

        // Test a specific product that we know has "INAVILITADO" in its name
        // Let's use a common SIIGO product code that might be inactive
        const testCodes = ['LIQUIPP07', 'LIQUIPP06', 'SAL001', 'MANG001'];
        
        for (const code of testCodes) {
            console.log(`\n🔍 Testing product code: ${code}`);
            
            try {
                const response = await axios.get(
                    `${this.siigoConfig.baseUrl}/v1/products?code=${code}`,
                    {
                        headers: {
                            'Authorization': this.token,
                            'Content-Type': 'application/json',
                            'Partner-Id': 'siigo'
                        }
                    }
                );

                if (response.data.results && response.data.results.length > 0) {
                    const product = response.data.results[0];
                    console.log('📊 Product data structure:');
                    console.log('Name:', product.name);
                    console.log('Code:', product.code);
                    console.log('Active field:', product.active);
                    console.log('Available quantity:', product.available_quantity);
                    console.log('Status:', product.status);
                    console.log('State:', product.state);
                    console.log('Full product object:', JSON.stringify(product, null, 2));
                } else {
                    console.log(`❌ No results found for code: ${code}`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error testing ${code}:`, error.response?.status, error.message);
                if (error.response?.data) {
                    console.error('Error details:', JSON.stringify(error.response.data, null, 2));
                }
            }
        }
        
        // Now let's test a different approach - get all products and filter
        console.log('\n🔍 Testing product listing...');
        try {
            const response = await axios.get(
                `${this.siigoConfig.baseUrl}/v1/products?page_size=5`,
                {
                    headers: {
                        'Authorization': this.token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    }
                }
            );
            
            console.log('📊 Sample products from listing:');
            if (response.data.results) {
                response.data.results.forEach(product => {
                    console.log(`Product: ${product.name} | Code: ${product.code} | Active: ${product.active} | Status: ${product.status}`);
                });
            }
            
        } catch (error) {
            console.error('❌ Error listing products:', error.response?.status, error.message);
            if (error.response?.data) {
                console.error('Error details:', JSON.stringify(error.response.data, null, 2));
            }
        }
    }
}

async function main() {
    const siigoDebugger = new SiigoStatusDebugger();
    await siigoDebugger.testInactiveProduct();
}

main().catch(console.error);
